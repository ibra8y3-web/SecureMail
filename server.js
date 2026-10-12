
const express = require('express');
const admin = require('firebase-admin');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Initialize Firebase Admin securely using environment variables.
function getFirebaseApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  // Supports environments that provide Application Default Credentials.
  return admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

let db;

try {
  getFirebaseApp();
  db = admin.firestore();
} catch (error) {
  console.error('Firebase initialization failed:', error.message);
}

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'SecureMail Webhook Server',
    firebaseConfigured: Boolean(db)
  });
});

// Inbound email webhook
app.post('/api/inbound', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        error: 'Firebase is not configured'
      });
    }

    const { recipient, sender, subject, body } = req.body || {};

    if (
      typeof recipient !== 'string' ||
      typeof subject !== 'string' ||
      !recipient.trim() ||
      !subject.trim()
    ) {
      return res.status(400).json({
        error: 'Valid recipient and subject are required'
      });
    }

    const normalizedRecipient = recipient.trim().toLowerCase();
    const normalizedSender =
      typeof sender === 'string' && sender.trim()
        ? sender.trim()
        : 'no-reply@external.com';

    const emailId =
      'ext_' +
      Date.now() +
      '_' +
      Math.random().toString(36).substring(2, 9);

    const emailData = {
      id: emailId,
      senderUid: 'external_gateway',
      senderEmail: normalizedSender,
      senderName: normalizedSender.split('@')[0],
      recipientEmail: normalizedRecipient,
      recipientUid: '',
      subject: subject.trim(),
      encryptedBody:
        typeof body === 'string' ? body : '(No content)',
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
    };

    await db.collection('emails').doc(emailId).set(emailData);

    console.log('Inbound email saved:', emailId);

    return res.status(200).json({
      success: true,
      emailId
    });
  } catch (error) {
    console.error('Inbound email processing failed:', error.message);

    return res.status(500).json({
      error: 'Unable to process inbound email'
    });
  }
});

// Vercel uses the exported Express app.
// Other hosting platforms can start the HTTP server directly.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`SecureMail server listening on port ${PORT}`);
  });
}

module.exports = app;
