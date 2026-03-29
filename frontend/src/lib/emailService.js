import emailjs from '@emailjs/browser';

// EmailJS Configuration
const EMAILJS_SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID || 'service_g0yq4qg';
const EMAILJS_TEMPLATE_ID = process.env.REACT_APP_EMAILJS_TEMPLATE_ID || 'template_wp63bpe';
const EMAILJS_PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY || 'kkB5lP8Fm-9ihoZnF';

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

/**
 * Send email notification for new client onboarding
 * @param {Object} params - Email parameters
 * @param {string} params.clientName - Name of the newly onboarded client
 * @param {string} params.clientEmail - Email of the client
 * @param {string} params.createdBy - Name of the user who created the client
 * @param {boolean} params.isPending - Whether the client needs admin approval
 * @param {string} params.adminEmail - Admin email to send notification to
 */
export const sendClientOnboardingNotification = async ({
  clientName,
  clientEmail,
  createdBy,
  isPending,
  adminEmail,
}) => {
  try {
    console.log('📧 EmailJS Config:', {
      serviceId: EMAILJS_SERVICE_ID,
      templateId: EMAILJS_TEMPLATE_ID,
      publicKey: EMAILJS_PUBLIC_KEY ? 'SET' : 'MISSING',
      adminEmail,
    });

    const templateParams = {
      client_name: clientName,
      client_email: clientEmail,
      created_by: createdBy,
      status: isPending ? 'Pending Approval' : 'Active',
      to_email: adminEmail,
      message: isPending
        ? `A new client "${clientName}" has been onboarded by ${createdBy} and is awaiting your approval.`
        : `A new client "${clientName}" has been onboarded by ${createdBy}.`,
    };

    console.log('📧 Sending email with params:', templateParams);

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams
    );

    console.log('✅ Email sent successfully:', response);
    return { success: true, response };
  } catch (error) {
    console.error('❌ Failed to send email notification:', error);
    return { success: false, error };
  }
};

/**
 * Send bulk notifications to multiple admins
 * @param {Array} admins - Array of admin objects with email and name
 * @param {Object} clientInfo - Client information
 */
export const sendBulkAdminNotifications = async (admins, clientInfo) => {
  const results = await Promise.allSettled(
    admins.map(admin =>
      sendClientOnboardingNotification({
        ...clientInfo,
        adminEmail: admin.email,
      })
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return { successful, failed, total: admins.length };
};
