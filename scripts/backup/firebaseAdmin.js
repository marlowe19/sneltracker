import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
// File-based fallbacks removed: only env-based credentials are supported

export function getDb() {
  if (!getApps().length) {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    let serviceAccount = null;
    let credentialSource = "unknown";

    // 1) Prefer base64-encoded JSON from env
    if (b64) {
      const decoded = Buffer.from(b64, "base64").toString();
      try {
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === "object") {
          serviceAccount = parsed;
          credentialSource = "env_b64";
        } else {
          throw new Error(
            "Decoded FIREBASE_SERVICE_ACCOUNT_JSON is not an object"
          );
        }
      } catch (e) {
        throw new Error(
          `Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      }
    }

    // Or construct from individual env vars
    if (!serviceAccount) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
      if (projectId && clientEmail && privateKeyRaw) {
        const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
        serviceAccount = {
          project_id: projectId,
          client_email: clientEmail,
          private_key: privateKey,
        };
        credentialSource = "env_fields";
      }
    }

    if (!serviceAccount) {
      throw new Error(
        "No Firebase credentials found. Provide FIREBASE_SERVICE_ACCOUNT_JSON (base64-encoded JSON) or set FIREBASE_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY."
      );
    }
    initializeApp({ credential: cert(serviceAccount) });
    // Stash minimal diagnostics on process for later health reporting
    try {
      const projectId = serviceAccount?.project_id || null;
      // Using an underscored property purely as a private stash for diagnostics
      process.__FIREBASE_ADMIN_DIAGNOSTICS__ = {
        projectId,
        credentialSource,
      };
    } catch (_) {
      // ignore
    }
  }
  return getFirestore();
}

export function getAdminDiagnostics() {
  const diag = process.__FIREBASE_ADMIN_DIAGNOSTICS__ || {};
  return {
    projectId:
      diag.projectId ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT_ID ||
      null,
    credentialSource: diag.credentialSource || null,
  };
}
