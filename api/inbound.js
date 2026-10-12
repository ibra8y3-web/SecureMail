const admin = require('firebase-admin');

// Initialize Firebase Admin safely
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  } catch (e) {
    console.log('Firebase init note:', e.message);
  }
}

const db = admin.apps.length ? admin.firestore() : null;

module.exports = async (req, res) => {
  // Handle GET test request so the link opens successfully without 500 error
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'success', 
      message: 'SecureMail Webhook Gateway is online and active 🚀' 
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recipient, sender, subject, body } = req.body || {};

    if (!recipient) {
      return res.status(400).json({ error: 'Missing recipient email' });
    }

    if (db) {
      const emailId = 'ext_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      await db.collection('emails').doc(emailId).set({
        id: emailId,
        senderUid: 'external_gateway',
        senderEmail: sender || 'no-reply@external.com',
        senderName: sender ? sender.split('@')[0] : 'External Site',
        recipientEmail: recipient,
        recipientUid: '',
        subject: subject || 'External Message',
        encryptedBody: body || '(No content)',
        isEncrypted: false,
        algorithm: 'Vercel-Webhook',
        folder: 'inbox',
        isRead: false,
        isStarred: false,
        isArchived: false,
        isDeleted: false,
        hasAttachments: false,
        attachmentCount: 0,
        priority: 'high',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true, emailId });
    } else {
      return res.status(200).json({ success: true, message: 'Webhook received successfully' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
