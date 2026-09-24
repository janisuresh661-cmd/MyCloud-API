const MAX_STORAGE = 600 * 1024 * 1024; // 600 MB

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

    return json({
      ok: true,
      message: "MyCloud API is running.",
      next: "Connect D1 and R2"
    });
  }
};
