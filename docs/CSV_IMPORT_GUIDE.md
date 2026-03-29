# Client CSV Import Guide

## Overview

The client import feature allows administrators to bulk import clients from a CSV (Comma-Separated Values) file.

## CSV Format Requirements

### Required Column
- **name** - Client's full name (required, cannot be empty)

### Optional Columns
- **email** - Client's email address
- **phone** - Client's phone number
- **address** - Client's physical address
- **notes** - Additional notes or comments about the client

## CSV Template

Download the template: `docs/client_import_template.csv`

Example CSV format:
```csv
name,email,phone,address,notes
"John Doe",john.doe@example.com,555-0101,"123 Main St, City, State 12345","New client referral"
"Jane Smith",jane.smith@example.com,555-0102,"456 Oak Ave, City, State 12345","Follow up needed"
```

## Import Steps

1. **Prepare your CSV file**
   - Save your spreadsheet as CSV (UTF-8 encoding)
   - Ensure "name" column header exists
   - Include optional columns as needed

2. **Login as Admin**
   - Only administrators can import clients
   - Navigate to the Clients page

3. **Click Import Button**
   - Look for the upload icon button
   - Select your CSV file
   - Wait for import to complete

4. **Review Results**
   - Success message shows how many clients were imported
   - Any errors will be displayed
   - Failed rows are skipped automatically

## Common Issues

### "Empty file uploaded"
- **Cause**: File has no content
- **Solution**: Ensure your CSV file contains data

### "CSV must have a 'name' column"
- **Cause**: Missing required column header
- **Solution**: Add "name" as the first column header

### "Invalid file encoding"
- **Cause**: CSV is not UTF-8 encoded
- **Solution**: Save your file as "CSV UTF-8" in Excel/Google Sheets

### "Row X: Missing name"
- **Cause**: Name field is empty for that row
- **Solution**: Fill in the name or remove the row

## Tips

- **Test with small files first** - Import 2-3 clients to test format
- **Use quotes for fields with commas** - e.g., "123 Main St, City, State"
- **Check for duplicates** - System does not automatically detect duplicate names
- **Keep a backup** - Save original spreadsheet before converting to CSV

## Permissions

- **ADMIN** - Can import clients
- **CASE_WORKER** - Cannot import (manual creation only)
- **VOLUNTEER** - Cannot import

## Support

If you encounter issues:
1. Check the CSV format matches the template
2. Verify you're logged in as an admin
3. Look at the error messages for specific row issues
4. Contact support with the error details
