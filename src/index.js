const MAX_STORAGE = 600 * 1024 * 1024;
const SESSION_DAYS = 30;

const B2_REGION = "us-east-005";
const B2_SERVICE = "s3";
const B2_ENDPOINT = "s3.us-east-005.backblazeb2.com";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://janisuresh661-cmd.github.io",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    const json = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders
        }
      });
    };

    // -----------------------------
    // Helpers
    // -----------------------------

    const bytesToHex = (bytes) =>
      Array.from(bytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

    const hexToBytes = (hex) => {
      const bytes = new Uint8Array(hex.length / 2);

      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
      }

      return bytes;
    };

    const bytesToBase64Url = (bytes) => {
      let binary = "";

      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }

      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    };

    const randomBytes = (length) => {
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      return bytes;
    };

    const normalizePhone = (phone) => {
      if (typeof phone !== "string") return null;

      let value = phone.trim().replace(/[\s()-]/g, "");

      // Convert Indian +91XXXXXXXXXX to 91XXXXXXXXXX
      if (value.startsWith("+")) {
        value = value.substring(1);
      }

      // Basic Indian mobile validation
      if (!/^91[6-9]\d{9}$/.test(value)) {
        return null;
      }

      return value;
    };

const hmac = async (key, message) => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      new TextEncoder().encode(message)
    )
  );
};

const hmacHex = async (key, message) => {
  return bytesToHex(await hmac(key, message));
};

const getB2SigningKey = async (secretKey, dateStamp) => {
  const kDate = await hmac(
    new TextEncoder().encode("AWS4" + secretKey),
    dateStamp
  );

  const kRegion = await hmac(kDate, B2_REGION);
  const kService = await hmac(kRegion, B2_SERVICE);
  return await hmac(kService, "aws4_request");
};

const verifyB2Object = async (objectKey) => {
  const bucket = env.B2_BUCKET_NAME;
  const accessKey = env.B2_KEY_ID;
  const secretKey = env.B2_APPLICATION_KEY;

  if (!bucket || !accessKey || !secretKey) {
    throw new Error("B2 configuration is missing");
  }

  const now = new Date();

  const amzDate = now.toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
    .replace("Z", "") + "Z";

  const dateStamp = amzDate.substring(0, 8);

  const credentialScope =
    `${dateStamp}/${B2_REGION}/${B2_SERVICE}/aws4_request`;

  const host = `${bucket}.${B2_ENDPOINT}`;

  const encodedKey = objectKey
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");

  const canonicalUri = `/${encodedKey}`;
  const canonicalQueryString = "";

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "host;x-amz-date";
  const payloadHash = await hashText("");

  const canonicalRequest = [
    "HEAD",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  const canonicalRequestHash =
    await hashText(canonicalRequest);

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join("\n");

  const signingKey =
    await getB2SigningKey(secretKey, dateStamp);

  const signature =
    await hmacHex(signingKey, stringToSign);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  const response = await fetch(
    `https://${host}${canonicalUri}`,
    {
      method: "HEAD",
      headers: {
        "X-Amz-Date": amzDate,
        "Authorization": authorization
      }
    }
  );

  return response;
};
    
    const createPresignedUploadUrl = async (objectKey, contentType) => {
  const bucket = env.B2_BUCKET_NAME;
  const accessKey = env.B2_KEY_ID;
  const secretKey = env.B2_APPLICATION_KEY;

  if (!bucket || !accessKey || !secretKey) {
    throw new Error("B2 configuration is missing");
  }

  const now = new Date();

  const amzDate =
    now.toISOString()
      .replace(/[:-]|\.\d{3}/g, "")
      .replace("Z", "") + "Z";

  const dateStamp = amzDate.substring(0, 8);

  const credentialScope =
    `${dateStamp}/${B2_REGION}/${B2_SERVICE}/aws4_request`;

  const host = `${bucket}.${B2_ENDPOINT}`;

  const encodedKey = objectKey
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");

  const canonicalUri = `/${encodedKey}`;

  const params = new URLSearchParams();

  params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  params.set("X-Amz-Credential", `${accessKey}/${credentialScope}`);
  params.set("X-Amz-Date", amzDate);
  params.set("X-Amz-Expires", "900");
  params.set("X-Amz-SignedHeaders", "host");

  const canonicalQueryString =
    [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
      )
      .join("&");

  const canonicalHeaders =
    `host:${host}\n`;

  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  const canonicalRequestHash = await hashText(canonicalRequest);

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join("\n");

  const signingKey =
    await getB2SigningKey(secretKey, dateStamp);

  const signature =
    await hmacHex(signingKey, stringToSign);

  const uploadUrl =
    `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

  return {
    uploadUrl,
    objectKey,
    contentType
  };
};
    
    const hashText = async (text) => {
      const data = new TextEncoder().encode(text);

      const hash = await crypto.subtle.digest(
        "SHA-256",
        data
      );

      return bytesToHex(new Uint8Array(hash));
    };

    const hashPassword = async (password) => {
      const salt = randomBytes(16);

      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
      );

      const bits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt,
          iterations: 100000,
          hash: "SHA-256"
        },
        keyMaterial,
        256
      );

      return {
        salt: bytesToHex(salt),
        hash: bytesToHex(new Uint8Array(bits))
      };
    };

    const verifyPassword = async (password, stored) => {
      try {
        const [saltHex, hashHex] = stored.split(".");

        if (!saltHex || !hashHex) {
          return false;
        }

        const salt = hexToBytes(saltHex);

        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(password),
          "PBKDF2",
          false,
          ["deriveBits"]
        );

        const bits = await crypto.subtle.deriveBits(
          {
            name: "PBKDF2",
            salt,
            iterations: 100000,
            hash: "SHA-256"
          },
          keyMaterial,
          256
        );

        return bytesToHex(new Uint8Array(bits)) === hashHex;
      } catch {
        return false;
      }
    };

    const createSession = async (userId) => {
      const token = bytesToBase64Url(randomBytes(32));
      const tokenHash = await hashText(token);

      const expires = new Date(
        Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      await env.DB.prepare(
        `INSERT INTO sessions
         (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)`
      )
        .bind(userId, tokenHash, expires)
        .run();

      return token;
    };

    const getTokenFromRequest = () => {
      const header = request.headers.get("Authorization");

      if (!header || !header.startsWith("Bearer ")) {
        return null;
      }

      return header.substring(7).trim();
    };

    const getCurrentUser = async () => {
      const token = getTokenFromRequest();

      if (!token) {
        return null;
      }

      const tokenHash = await hashText(token);

      const result = await env.DB.prepare(
        `SELECT
           users.id,
           users.user_id,
           users.storage_used,
           sessions.id AS session_id
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ?
           AND sessions.expires_at > CURRENT_TIMESTAMP`
      )
        .bind(tokenHash)
        .first();

      return result || null;
    };

    const generateRecoveryCode = () => {
      const makePart = () => {
        let part = "";

        for (let i = 0; i < 4; i++) {
          const index =
            randomBytes(1)[0] % ALPHABET.length;

          part += ALPHABET[index];
        }

        return part;
      };

      return `MC-${makePart()}-${makePart()}-${makePart()}`;
    };

    // -----------------------------
    // Health
    // -----------------------------

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "MyCloud API",
        storageLimit: MAX_STORAGE
      });
    }

    // -----------------------------
    // B2 connection test
    // -----------------------------

    if (url.pathname === "/api/b2-test") {
      try {
        if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY) {
          return json({
            ok: false,
            error: "B2 credentials are missing"
          }, 500);
        }

        const credentials = btoa(
          `${env.B2_KEY_ID}:${env.B2_APPLICATION_KEY}`
        );

        const response = await fetch(
          "https://api.backblazeb2.com/b2api/v4/b2_authorize_account",
          {
            method: "GET",
            headers: {
              "Authorization": `Basic ${credentials}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          return json({
            ok: false,
            status: response.status,
            code: data.code || "unknown",
            error: data.message || "Backblaze authorization failed"
          }, response.status);
        }

        return json({
          ok: true,
          service: "MyCloud API",
          b2: "connected",
          bucket: env.B2_BUCKET_NAME,
          message: "Backblaze B2 connection successful"
        });
      } catch {
        return json({
          ok: false,
          error: "B2 connection failed"
        }, 500);
      }
    }

    // -----------------------------
    // REGISTER
    // -----------------------------

    if (
      url.pathname === "/api/register" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.json();

        const phone = normalizePhone(body.phone);
        const password = body.password;
        const confirmPassword = body.confirmPassword;

        if (!phone) {
          return json({
            ok: false,
            error: "Enter a valid Indian mobile number"
          }, 400);
        }

        if (
          typeof password !== "string" ||
          password.length < 8
        ) {
          return json({
            ok: false,
            error: "Password must be at least 8 characters"
          }, 400);
        }

        if (password !== confirmPassword) {
          return json({
            ok: false,
            error: "Passwords do not match"
          }, 400);
        }

        const existing = await env.DB.prepare(
          "SELECT id FROM users WHERE user_id = ?"
        )
          .bind(phone)
          .first();

        if (existing) {
          return json({
            ok: false,
            error: "An account already exists for this phone number"
          }, 409);
        }

        const passwordData =
          await hashPassword(password);

        const storedPassword =
          `${passwordData.salt}.${passwordData.hash}`;

        const insertUser = await env.DB.prepare(
          `INSERT INTO users
           (user_id, password_hash, storage_used)
           VALUES (?, ?, 0)`
        )
          .bind(phone, storedPassword)
          .run();

        const userId = insertUser.meta.last_row_id;

        const recoveryCodes = [];

        for (let i = 0; i < 5; i++) {
          const code = generateRecoveryCode();
          const codeHash = await hashText(code);

          await env.DB.prepare(
            `INSERT INTO recovery_codes
             (user_id, code_hash)
             VALUES (?, ?)`
          )
            .bind(userId, codeHash)
            .run();

          recoveryCodes.push(code);
        }

        const sessionToken =
          await createSession(userId);

        return json({
          ok: true,
          message: "Account created successfully",
          user: {
            id: userId,
            phone: phone
          },
          sessionToken,
          recoveryCodes
        }, 201);

      } catch (error) {
        return json({
          ok: false,
          error: "Registration failed"
        }, 500);
      }
    }

    // -----------------------------
    // LOGIN
    // -----------------------------

    if (
      url.pathname === "/api/login" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.json();

        const phone = normalizePhone(body.phone);
        const password = body.password;

        if (!phone || typeof password !== "string") {
          return json({
            ok: false,
            error: "Phone number and password are required"
          }, 400);
        }

        const user = await env.DB.prepare(
          `SELECT id, user_id, password_hash, storage_used
           FROM users
           WHERE user_id = ?`
        )
          .bind(phone)
          .first();

        if (!user) {
          return json({
            ok: false,
            error: "Invalid phone number or password"
          }, 401);
        }

        const valid = await verifyPassword(
          password,
          user.password_hash
        );

        if (!valid) {
          return json({
            ok: false,
            error: "Invalid phone number or password"
          }, 401);
        }

        const sessionToken =
          await createSession(user.id);

        return json({
          ok: true,
          message: "Login successful",
          sessionToken,
          user: {
            id: user.id,
            phone: user.user_id,
            storageUsed: user.storage_used,
            storageLimit: MAX_STORAGE
          }
        });

      } catch {
        return json({
          ok: false,
          error: "Login failed"
        }, 500);
      }
    }

    // -----------------------------
    // LOGOUT
    // -----------------------------

    if (
      url.pathname === "/api/logout" &&
      request.method === "POST"
    ) {
      const token = getTokenFromRequest();

      if (!token) {
        return json({
          ok: true,
          message: "Logged out"
        });
      }

      const tokenHash = await hashText(token);

      await env.DB.prepare(
        "DELETE FROM sessions WHERE token_hash = ?"
      )
        .bind(tokenHash)
        .run();

      return json({
        ok: true,
        message: "Logged out successfully"
      });
    }

    // -----------------------------
    // CURRENT USER
    // -----------------------------

    if (
      url.pathname === "/api/me" &&
      request.method === "GET"
    ) {
      const user = await getCurrentUser();

      if (!user) {
        return json({
          ok: false,
          error: "Not authenticated"
        }, 401);
      }

      return json({
        ok: true,
        user: {
          id: user.id,
          phone: user.user_id,
          storageUsed: user.storage_used,
          storageLimit: MAX_STORAGE
        }
      });
    }

  if (request.method === "GET" && url.pathname === "/api/files") {
    const user = await getCurrentUser();

    if (!user) {
      return json(
        { ok: false, message: "Not authenticated" },
        401
      );
    }

    const result = await env.DB.prepare(
      `SELECT
         id,
         filename,
         storage_key,
         file_size,
         mime_type,
         uploaded_at
       FROM files
       WHERE user_id = ?
       ORDER BY uploaded_at DESC`
    )
      .bind(user.id)
      .all();

    return json({
      ok: true,
      files: result.results || [],
      storageUsed: user.storage_used,
      storageLimit: MAX_STORAGE
    });
  }
    
    if (request.method === "POST" && url.pathname === "/api/files/upload-url") {
  const user = await getCurrentUser();

  if (!user) {
    return json(
      { ok: false, message: "Not authenticated" },
      401
    );
  }

  try {
    const body = await request.json();

    const filename =
      typeof body.filename === "string"
        ? body.filename.trim()
        : "";

    const fileSize = Number(body.fileSize);
    const contentType =
      typeof body.contentType === "string" &&
      body.contentType.trim()
        ? body.contentType.trim()
        : "application/octet-stream";

    if (!filename) {
      return json(
        { ok: false, message: "Filename is required" },
        400
      );
    }

    if (
      !Number.isSafeInteger(fileSize) ||
      fileSize <= 0
    ) {
      return json(
        { ok: false, message: "Invalid file size" },
        400
      );
    }

    if (fileSize > MAX_STORAGE) {
      return json(
        {
          ok: false,
          message: "File is larger than the 600 MB storage limit"
        },
        400
      );
    }

    const storageUsed = Number(user.storage_used || 0);
    const remainingStorage = MAX_STORAGE - storageUsed;

    if (fileSize > remainingStorage) {
      return json(
        {
          ok: false,
          message: "Not enough storage available",
          storageUsed,
          storageLimit: MAX_STORAGE,
          remainingStorage
        },
        400
      );
    }

    const safeName = filename
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .substring(0, 180);

    const objectKey =
      `users/${user.id}/${crypto.randomUUID()}-${safeName}`;

    const upload = await createPresignedUploadUrl(
      objectKey,
      contentType
    );

    await env.DB.prepare(
  `INSERT INTO pending_uploads
   (user_id, object_key, filename, file_size, mime_type)
   VALUES (?, ?, ?, ?, ?)`
)
  .bind(
    user.id,
    objectKey,
    filename,
    fileSize,
    contentType
  )
  .run();

    return json({
      ok: true,
      uploadUrl: upload.uploadUrl,
      objectKey: upload.objectKey,
      filename,
      fileSize,
      contentType,
      storageUsed,
      storageLimit: MAX_STORAGE,
      remainingStorage
    });

  } catch (error) {
    return json(
      {
        ok: false,
        message: error instanceof Error
          ? error.message
          : "Could not create upload URL"
      },
      500
    );
  }
}

// --------------------------------
// COMPLETE FILE UPLOAD
// --------------------------------

if (
  request.method === "POST" &&
  url.pathname === "/api/files/complete"
) {
  const user = await getCurrentUser();

  if (!user) {
    return json(
      { ok: false, message: "Not authenticated" },
      401
    );
  }

  try {
    const body = await request.json();

    const objectKey =
      typeof body.objectKey === "string"
        ? body.objectKey.trim()
        : "";

    if (!objectKey) {
      return json(
        { ok: false, message: "Object key is required" },
        400
      );
    }

    // Make sure the object belongs to this user.
    if (!objectKey.startsWith(`users/${user.id}/`)) {
      return json(
        { ok: false, message: "Invalid object key" },
        403
      );
    }

    const pending = await env.DB.prepare(
      `SELECT
         id,
         filename,
         file_size,
         mime_type,
         object_key
       FROM pending_uploads
       WHERE user_id = ?
         AND object_key = ?`
    )
      .bind(user.id, objectKey)
      .first();

    if (!pending) {
      return json(
        { ok: false, message: "Pending upload not found" },
        404
      );
    }

    // Verify that the file really exists in Backblaze B2.
    const b2Response = await verifyB2Object(objectKey);

    if (!b2Response.ok) {
      return json(
        {
          ok: false,
          message: "File upload could not be verified"
        },
        400
      );
    }

    const actualSize = Number(
      b2Response.headers.get("content-length") || 0
    );

    if (actualSize !== pending.file_size) {
      return json(
        {
          ok: false,
          message: "Uploaded file size does not match"
        },
        400
      );
    }

    const currentUser = await env.DB.prepare(
      `SELECT storage_used
       FROM users
       WHERE id = ?`
    )
      .bind(user.id)
      .first();

    const storageUsed = Number(
      currentUser?.storage_used || 0
    );

    if (storageUsed + pending.file_size > MAX_STORAGE) {
      return json(
        {
          ok: false,
          message: "Storage limit exceeded"
        },
        400
      );
    }

    const newStorageUsed =
      storageUsed + pending.file_size;

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO files
         (user_id, filename, storage_key, file_size, mime_type)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        user.id,
        pending.filename,
        pending.object_key,
        pending.file_size,
        pending.mime_type
      ),

      env.DB.prepare(
        `UPDATE users
         SET storage_used = ?
         WHERE id = ?`
      ).bind(
        newStorageUsed,
        user.id
      ),

      env.DB.prepare(
        `DELETE FROM pending_uploads
         WHERE id = ?`
      ).bind(
        pending.id
      )
    ]);

    return json({
      ok: true,
      message: "File uploaded successfully",
      file: {
        filename: pending.filename,
        fileSize: pending.file_size,
        mimeType: pending.mime_type,
        storageKey: pending.object_key
      },
      storageUsed: newStorageUsed,
      storageLimit: MAX_STORAGE,
      remainingStorage:
        MAX_STORAGE - newStorageUsed
    });

  } catch (error) {
    return json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not complete file upload"
      },
      500
    );
  }
}
    
    // -----------------------------
    // FORGOT PASSWORD
    // -----------------------------

    if (
      url.pathname === "/api/forgot-password" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.json();

        const phone = normalizePhone(body.phone);
        const recoveryCode = body.recoveryCode;
        const newPassword = body.newPassword;
        const confirmPassword = body.confirmPassword;

        if (!phone || typeof recoveryCode !== "string") {
          return json({
            ok: false,
            error: "Phone number and recovery code are required"
          }, 400);
        }

        if (
          typeof newPassword !== "string" ||
          newPassword.length < 8
        ) {
          return json({
            ok: false,
            error: "New password must be at least 8 characters"
          }, 400);
        }

        if (newPassword !== confirmPassword) {
          return json({
            ok: false,
            error: "Passwords do not match"
          }, 400);
        }

        const user = await env.DB.prepare(
          "SELECT id FROM users WHERE user_id = ?"
        )
          .bind(phone)
          .first();

        if (!user) {
          return json({
            ok: false,
            error: "Invalid recovery details"
          }, 401);
        }

        const codeHash =
          await hashText(recoveryCode.trim().toUpperCase());

        const recovery = await env.DB.prepare(
          `SELECT id
           FROM recovery_codes
           WHERE user_id = ?
             AND code_hash = ?
             AND used = 0`
        )
          .bind(user.id, codeHash)
          .first();

        if (!recovery) {
          return json({
            ok: false,
            error: "Invalid or already used recovery code"
          }, 401);
        }

        const passwordData =
          await hashPassword(newPassword);

        const storedPassword =
          `${passwordData.salt}.${passwordData.hash}`;

        await env.DB.prepare(
          "UPDATE users SET password_hash = ? WHERE id = ?"
        )
          .bind(storedPassword, user.id)
          .run();

        await env.DB.prepare(
          "UPDATE recovery_codes SET used = 1 WHERE id = ?"
        )
          .bind(recovery.id)
          .run();

        // Invalidate all existing sessions after password reset
        await env.DB.prepare(
          "DELETE FROM sessions WHERE user_id = ?"
        )
          .bind(user.id)
          .run();

        return json({
          ok: true,
          message: "Password changed successfully"
        });

      } catch {
        return json({
          ok: false,
          error: "Password reset failed"
        }, 500);
      }
    }

    // -----------------------------
    // 404
    // -----------------------------

    return json({
      ok: true,
      message: "MyCloud API is running."
    });
  }
};
