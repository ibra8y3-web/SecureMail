const express = require('express');
const admin = require('firebase-admin');

// Initialize Firebase Admin (Using environment variables or service account)
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhook endpoint that Cloudflare Email Routing or SendGrid will call
app.post('/api/inbound', async (req, res) => {
  try {
    const { recipient, sender, subject, body } = req.body;

    if (!recipient || !subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const emailId = 'ext_' + Date.now() + '_' + Math.random().toString(36.substring(2, 7));

    // Save incoming email to Firestore
    await db.collection('emails').doc(emailId).set({
      id: emailId,
      senderUid: 'external_gateway',
      senderEmail: sender || 'no-reply@external.com',
      senderName: sender ? sender.split('@')[0] : 'External Site',
      recipientEmail: recipient,
      recipientUid: '', // Will be matched by recipient email in app
      subject: subject,
      encryptedBody: body || '(No content)',
      isEncrypted: false,
      algorithm: 'Webhook-Inbound',
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

    console.log(`Successfully processed inbound email for ${recipient}`);
    return res.status(200).json({ success: true, emailId });
  } catch (error) {
    console.error('Error processing inbound email webhook:', error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SecureMail Webhook Server running on port ${PORT}`);
});
