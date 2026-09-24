const MAX_STORAGE = 600 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
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

    // Health check
    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "MyCloud API",
        storageLimit: MAX_STORAGE
      });
    }

    // Backblaze B2 connection test
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
      } catch (error) {
        return json({
          ok: false,
          error: "B2 connection failed"
        }, 500);
      }
    }

    return json({
      ok: true,
      message: "MyCloud API is running."
    });
  }
};        if (!response.ok) {
          return json({
            ok: false,
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
      } catch (error) {
        return json({
          ok: false,
          error: "B2 connection failed"
        }, 500);
      }
    }

    return json({
      ok: true,
      message: "MyCloud API is running."
    });
  }
};
