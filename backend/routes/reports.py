from fastapi import APIRouter, Request, Response, HTTPException
from bson import ObjectId
from datetime import datetime, timezone
import csv
import io

from config import db, logger
from helpers import get_current_user, require_role, serialize_doc

router = APIRouter()

@router.get("/reports/export")
async def export_csv(request: Request):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    clients = await db.clients.find({"tenant_id": tid, "is_archived": {"$ne": True}}, {"_id": 0}).to_list(10000)
    output = io.StringIO()
    if clients:
        writer = csv.DictWriter(output, fieldnames=["name", "email", "phone", "address", "pending", "created_at"])
        writer.writeheader()
        for c in clients:
            writer.writerow({k: c.get(k, "") for k in ["name", "email", "phone", "address", "pending", "created_at"]})
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=clients_export.csv"})

# ── Dashboard CSV Export (R27.7) ──
@router.get("/reports/dashboard-csv")
async def export_dashboard_csv(request: Request):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    from collections import defaultdict
    total_clients = await db.clients.count_documents({"tenant_id": tid, "is_archived": {"$ne": True}})
    total_services = await db.service_logs.count_documents({"tenant_id": tid})
    total_visits = await db.visits.count_documents({"tenant_id": tid})
    total_outcomes = await db.outcomes.count_documents({"tenant_id": tid})
    start = datetime.now(timezone.utc) - __import__("datetime").timedelta(days=30)
    start_str = start.strftime("%Y-%m-%d")
    services = await db.service_logs.find({"tenant_id": tid, "service_date": {"$gte": start_str}}, {"_id": 0, "service_date": 1}).to_list(5000)
    visits = await db.visits.find({"tenant_id": tid, "date": {"$gte": start_str}}, {"_id": 0, "date": 1}).to_list(5000)
    day_data = defaultdict(lambda: {"services": 0, "visits": 0})
    for s in services:
        day = (s.get("service_date") or "")[:10]
        if day:
            day_data[day]["services"] += 1
    for v in visits:
        day = (v.get("date") or "")[:10]
        if day:
            day_data[day]["visits"] += 1
    output = io.StringIO()
    output.write("DASHBOARD SUMMARY\n")
    output.write(f"Total Clients,{total_clients}\n")
    output.write(f"Total Services,{total_services}\n")
    output.write(f"Total Visits,{total_visits}\n")
    output.write(f"Total Outcomes,{total_outcomes}\n\n")
    output.write("DAILY ACTIVITY TRENDS (Last 30 Days)\n")
    writer = csv.DictWriter(output, fieldnames=["date", "services", "visits"])
    writer.writeheader()
    for day in sorted(day_data.keys()):
        writer.writerow({"date": day, "services": day_data[day]["services"], "visits": day_data[day]["visits"]})
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=dashboard_export.csv"})

@router.get("/reports/export/{report_type}")
async def export_typed_csv(report_type: str, request: Request):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    output = io.StringIO()

    if report_type == "services":
        records = await db.service_logs.find({"tenant_id": tid}).sort("service_date", -1).to_list(10000)
        if records:
            writer = csv.DictWriter(output, fieldnames=["client_id", "service_date", "service_type", "provider_name", "notes", "created_at"])
            writer.writeheader()
            for r in records:
                writer.writerow({k: r.get(k, "") for k in writer.fieldnames})
        filename = "services_export.csv"
    elif report_type == "visits":
        records = await db.visits.find({"tenant_id": tid}).sort("date", -1).to_list(10000)
        if records:
            writer = csv.DictWriter(output, fieldnames=["client_id", "date", "duration", "status", "case_worker_name", "notes", "created_at"])
            writer.writeheader()
            for r in records:
                writer.writerow({k: r.get(k, "") for k in writer.fieldnames})
        filename = "visits_export.csv"
    elif report_type == "outcomes":
        records = await db.outcomes.find({"tenant_id": tid}).sort("created_at", -1).to_list(10000)
        if records:
            writer = csv.DictWriter(output, fieldnames=["client_id", "goal_description", "target_date", "status", "created_at"])
            writer.writeheader()
            for r in records:
                writer.writerow({k: r.get(k, "") for k in writer.fieldnames})
        filename = "outcomes_export.csv"
    elif report_type == "payments":
        records = await db.payment_requests.find({"tenant_id": tid}).sort("created_at", -1).to_list(10000)
        if records:
            writer = csv.DictWriter(output, fieldnames=["client_name", "client_email", "amount", "description", "due_date", "status", "created_at"])
            writer.writeheader()
            for r in records:
                writer.writerow({k: r.get(k, "") for k in writer.fieldnames})
        filename = "payments_export.csv"
    else:
        raise HTTPException(status_code=400, detail="Invalid report type. Use: services, visits, outcomes, payments")

    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})

# ── AI Narrative Report (R35.4) ──
@router.post("/reports/narrative")
async def generate_narrative_report(request: Request):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    body = await request.json()
    client_ids = body.get("client_ids", [])  # Empty = all clients
    # Fetch clients
    if client_ids:
        query = {"tenant_id": tid, "is_archived": {"$ne": True}, "_id": {"$in": [ObjectId(c) for c in client_ids]}}
    else:
        query = {"tenant_id": tid, "is_archived": {"$ne": True}}
    clients = await db.clients.find(query).to_list(200)
    if not clients:
        raise HTTPException(status_code=404, detail="No clients found")
    # Build context per client
    narratives = []
    for c in clients:
        cid = str(c["_id"])
        cname = c.get("name", "Unknown")
        services = await db.service_logs.find({"client_id": cid, "tenant_id": tid}).sort("service_date", -1).to_list(20)
        outcomes = await db.outcomes.find({"client_id": cid, "tenant_id": tid}).to_list(20)
        visits = await db.visits.find({"client_id": cid, "tenant_id": tid}).sort("date", -1).to_list(20)
        svc_summary = f"{len(services)} service(s)" if services else "No services recorded"
        if services:
            types = set(s.get("service_type", "") for s in services if s.get("service_type"))
            svc_summary += f" across {', '.join(list(types)[:5])}"
            latest = services[0].get("service_date", "N/A")
            svc_summary += f". Most recent: {latest}"
        out_summary = f"{len(outcomes)} outcome goal(s)" if outcomes else "No outcome goals set"
        if outcomes:
            achieved = sum(1 for o in outcomes if o.get("status") == "ACHIEVED")
            in_prog = sum(1 for o in outcomes if o.get("status") == "IN_PROGRESS")
            out_summary += f" ({achieved} achieved, {in_prog} in progress)"
        visit_summary = f"{len(visits)} visit(s)" if visits else "No visits scheduled"
        if visits:
            completed = sum(1 for v in visits if v.get("status") == "COMPLETED")
            visit_summary += f" ({completed} completed)"
        # Try AI generation
        narrative_text = None
        try:
            from helpers import hf_client, hf_generate
            if hf_client:
                ctx = f"Client: {cname}\nServices: {svc_summary}\nOutcomes: {out_summary}\nVisits: {visit_summary}"
                if c.get("notes"):
                    ctx += f"\nNotes: {c['notes']}"
                prompt = f"<s>[INST] Write a professional 3-4 sentence case narrative summary for a nonprofit case management report about this client:\n{ctx}\n[/INST]"
                result = await hf_generate(prompt, 300)
                if result and len(result.strip()) > 20:
                    narrative_text = result.strip()
        except Exception as e:
            logger.warning(f"AI narrative generation failed for {cname}: {e}")
        if not narrative_text:
            # Fallback narrative
            status_text = "active" if not c.get("pending") else "pending approval"
            narrative_text = (
                f"{cname} is currently an {status_text} client in the program. "
                f"They have {svc_summary}. "
                f"Regarding outcomes, there are {out_summary}. "
                f"In terms of engagement, the client has {visit_summary}. "
            )
            if c.get("notes"):
                narrative_text += f"Additional notes: {c['notes']}"
        narratives.append({
            "client_id": cid,
            "client_name": cname,
            "narrative": narrative_text,
            "stats": {
                "services": len(services),
                "outcomes": len(outcomes),
                "visits": len(visits),
            },
        })
    return {
        "narratives": narratives,
        "total_clients": len(narratives),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

@router.get("/reports/client/{client_id}/pdf")
async def client_pdf_report(client_id: str, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    tid = user.get("tenant_id")
    client = await db.clients.find_one({"_id": ObjectId(client_id), "tenant_id": tid})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    services = await db.service_logs.find({"client_id": client_id, "tenant_id": tid}).sort("service_date", -1).to_list(100)
    outcomes = await db.outcomes.find({"client_id": client_id, "tenant_id": tid}).sort("created_at", -1).to_list(100)
    visits = await db.visits.find({"client_id": client_id, "tenant_id": tid}).sort("date", -1).to_list(100)

    buf = io.BytesIO()
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch
        from reportlab.lib.colors import HexColor
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=20, textColor=HexColor('#F97316'), spaceAfter=6)
        heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=13, textColor=HexColor('#1F2937'), spaceBefore=16, spaceAfter=8)
        body_style = ParagraphStyle('CustomBody', parent=styles['Normal'], fontSize=10, textColor=HexColor('#4B5563'))
        small_style = ParagraphStyle('CustomSmall', parent=styles['Normal'], fontSize=8, textColor=HexColor('#9CA3AF'))

        elements = []
        # Header
        elements.append(Paragraph("HackForge - Client Report", title_style))
        elements.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%B %d, %Y')}", small_style))
        elements.append(Spacer(1, 12))

        # Client Info
        elements.append(Paragraph("Client Information", heading_style))
        info_data = [
            ["Name", client.get("name", "—")],
            ["Email", client.get("email", "—") or "—"],
            ["Phone", client.get("phone", "—") or "—"],
            ["Address", client.get("address", "—") or "—"],
        ]
        demo = client.get("demographics", {})
        if demo:
            for k, v in demo.items():
                if v:
                    info_data.append([k.replace("_", " ").title(), str(v)])
        info_table = Table(info_data, colWidths=[1.5*inch, 5*inch])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#6B7280')),
            ('TEXTCOLOR', (1, 0), (1, -1), HexColor('#1F2937')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(info_table)

        # Services
        if services:
            elements.append(Paragraph(f"Services ({len(services)})", heading_style))
            svc_data = [["Date", "Type", "Provider", "Notes"]]
            for s in services[:20]:
                svc_data.append([s.get("service_date", ""), s.get("service_type", ""), s.get("provider_name", ""), (s.get("notes", "") or "")[:50]])
            svc_table = Table(svc_data, colWidths=[1*inch, 1.5*inch, 1.5*inch, 2.5*inch])
            svc_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#FFF7ED')),
                ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#F97316')),
                ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E7EB')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(svc_table)

        # Outcomes
        if outcomes:
            elements.append(Paragraph(f"Outcomes ({len(outcomes)})", heading_style))
            out_data = [["Goal", "Target Date", "Status"]]
            for o in outcomes[:20]:
                out_data.append([o.get("goal_description", "")[:40], o.get("target_date", ""), o.get("status", "")])
            out_table = Table(out_data, colWidths=[3*inch, 1.5*inch, 2*inch])
            out_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#F0FDFA')),
                ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#14B8A6')),
                ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E7EB')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(out_table)

        # Visits
        if visits:
            elements.append(Paragraph(f"Visits ({len(visits)})", heading_style))
            vis_data = [["Date", "Duration", "Status", "Notes"]]
            for v in visits[:20]:
                vis_data.append([str(v.get("date", ""))[:16], f"{v.get('duration', 60)} min", v.get("status", ""), (v.get("notes", "") or "")[:40]])
            vis_table = Table(vis_data, colWidths=[1.5*inch, 1*inch, 1.5*inch, 2.5*inch])
            vis_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#EEF2FF')),
                ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#6366F1')),
                ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E7EB')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(vis_table)

        doc.build(elements)
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    buf.seek(0)
    client_name = client.get("name", "client").replace(" ", "_")
    return Response(content=buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={client_name}_report.pdf"})

@router.get("/reports/org/pdf")
async def org_pdf_report(request: Request):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    tenant = await db.tenants.find_one({"_id": ObjectId(tid)})
    org_name = tenant.get("name", "Organization") if tenant else "Organization"

    client_count = await db.clients.count_documents({"tenant_id": tid, "is_archived": {"$ne": True}})
    service_count = await db.service_logs.count_documents({"tenant_id": tid})
    visit_count = await db.visits.count_documents({"tenant_id": tid})
    outcome_count = await db.outcomes.count_documents({"tenant_id": tid})

    # Outcome breakdown
    outcome_pipeline = [{"$match": {"tenant_id": tid}}, {"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    outcome_stats = await db.outcomes.aggregate(outcome_pipeline).to_list(10)

    # Service type breakdown
    svc_pipeline = [{"$match": {"tenant_id": tid}}, {"$group": {"_id": "$service_type", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 10}]
    svc_stats = await db.service_logs.aggregate(svc_pipeline).to_list(10)

    # Payment summary
    pay_pipeline = [{"$match": {"tenant_id": tid}}, {"$group": {"_id": "$status", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}]
    pay_stats = await db.payment_requests.aggregate(pay_pipeline).to_list(10)

    buf = io.BytesIO()
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch
        from reportlab.lib.colors import HexColor
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title2', parent=styles['Title'], fontSize=22, textColor=HexColor('#F97316'), spaceAfter=6)
        heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=14, textColor=HexColor('#1F2937'), spaceBefore=16, spaceAfter=8)
        body_style = ParagraphStyle('Body2', parent=styles['Normal'], fontSize=10, textColor=HexColor('#4B5563'))
        small_style = ParagraphStyle('Small2', parent=styles['Normal'], fontSize=8, textColor=HexColor('#9CA3AF'))

        elements = []
        elements.append(Paragraph(f"HackForge - {org_name} Report", title_style))
        elements.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%B %d, %Y')}", small_style))
        elements.append(Spacer(1, 16))

        # Summary stats
        elements.append(Paragraph("Organization Overview", heading_style))
        stats_data = [
            ["Total Clients", str(client_count)],
            ["Total Services", str(service_count)],
            ["Total Visits", str(visit_count)],
            ["Total Outcomes", str(outcome_count)],
        ]
        stats_table = Table(stats_data, colWidths=[2*inch, 2*inch])
        stats_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#6B7280')),
            ('TEXTCOLOR', (1, 0), (1, -1), HexColor('#1F2937')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(stats_table)

        # Service breakdown
        if svc_stats:
            elements.append(Paragraph("Top Services by Volume", heading_style))
            svc_data = [["Service Type", "Count"]]
            for s in svc_stats:
                svc_data.append([s["_id"] or "Unknown", str(s["count"])])
            svc_table = Table(svc_data, colWidths=[4*inch, 1.5*inch])
            svc_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#FFF7ED')),
                ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#F97316')),
                ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E7EB')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(svc_table)

        # Outcome breakdown
        if outcome_stats:
            elements.append(Paragraph("Outcome Status Breakdown", heading_style))
            out_data = [["Status", "Count"]]
            for o in outcome_stats:
                out_data.append([o["_id"] or "Unknown", str(o["count"])])
            out_table = Table(out_data, colWidths=[3*inch, 1.5*inch])
            out_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#F0FDFA')),
                ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#14B8A6')),
                ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E7EB')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(out_table)

        # Payment breakdown
        if pay_stats:
            elements.append(Paragraph("Payment Summary", heading_style))
            pay_data = [["Status", "Count", "Total Amount"]]
            for p in pay_stats:
                pay_data.append([p["_id"] or "Unknown", str(p["count"]), f"${p['total']:.2f}"])
            pay_table = Table(pay_data, colWidths=[2*inch, 1.5*inch, 2*inch])
            pay_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#EEF2FF')),
                ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#6366F1')),
                ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E7EB')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(pay_table)

        doc.build(elements)
    except Exception as e:
        logger.error(f"Org PDF error: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    buf.seek(0)
    return Response(content=buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={org_name.replace(' ','_')}_report.pdf"})
