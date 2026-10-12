const admin = require('firebase-admin');

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
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'SecureMail Wildcard Gateway is active 🚀' });
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
      // 1. Find which user owns this mail address in Firestore (/users collection)
      let recipientUid = '';
      const userQuery = await db.collection('users').where('mailAddress', '==', recipient.toLowerCase().trim()).limit(1).get();
      if (!userQuery.empty) {
        recipientUid = userQuery.docs[0].id;
      } else {
        // Fallback: search by email prefix
        const emailPrefix = recipient.split('@')[0];
        const altQuery = await db.collection('users').where('email', '>=', emailPrefix).limit(5).get();
        if (!altQuery.empty) {
          recipientUid = altQuery.docs[0].id;
        }
      }

      // 2. Create encrypted/inbound email document
      const emailId = 'ext_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      await db.collection('emails').doc(emailId).set({
        id: emailId,
        senderUid: 'external_gateway',
        senderEmail: sender || 'no-reply@external.com',
        senderName: sender ? sender.split('@')[0] : 'External Site',
        recipientEmail: recipient,
        recipientUid: recipientUid, // Automatically matched to the correct user!
        subject: subject || 'External Verification',
        encryptedBody: body || '(No content)',
        isEncrypted: false,
        algorithm: 'Wildcard-Webhook',
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

      return res.status(200).json({ success: true, emailId, matchedUid: recipientUid });
    } else {
      return res.status(200).json({ success: true, message: 'Wildcard webhook received' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
