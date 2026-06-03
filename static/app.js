// Lightweight helpers shared across the Castle demo pages (no jQuery).

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data || {}),
  });
  let body;
  try {
    body = await res.json();
  } catch (e) {
    body = { error: "Server returned a non-JSON response (status " + res.status + ")." };
  }
  return body;
}

// Resolve a Castle request token, falling back gracefully if the browser SDK
// is unavailable (e.g. no publishable key configured).
function withRequestToken(callback) {
  if (window.Castle && typeof Castle.createRequestToken === "function") {
    Castle.createRequestToken()
      .then(callback)
      .catch(function (err) {
        console.error("Castle.createRequestToken failed", err);
        callback("");
      });
  } else {
    callback("");
  }
}

function syntaxHighlight(obj) {
  let json = JSON.stringify(obj, null, 2);
  json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    function (match) {
      let cls = "n";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "k" : "s";
      } else if (/true|false/.test(match)) {
        cls = "b";
      } else if (/null/.test(match)) {
        cls = "z";
      }
      return '<span class="' + cls + '">' + match + "</span>";
    },
  );
}

function clearResults() {
  const el = document.getElementById("results");
  if (el) el.innerHTML = "";
}

function addEndpointBadge(endpoint) {
  const el = document.getElementById("results");
  if (!el) return;
  const wrap = document.createElement("div");
  wrap.className = "result-block";
  wrap.innerHTML =
    '<div class="label">Castle endpoint</div><span class="badge endpoint">/' + endpoint + "</span>";
  el.appendChild(wrap);
}

function addJSONBlock(label, value) {
  const el = document.getElementById("results");
  if (!el) return;
  const wrap = document.createElement("div");
  wrap.className = "result-block";
  const lbl = document.createElement("div");
  lbl.className = "label";
  lbl.textContent = label;
  const pre = document.createElement("pre");
  pre.className = "json";
  pre.innerHTML = syntaxHighlight(value);
  wrap.appendChild(lbl);
  wrap.appendChild(pre);
  el.appendChild(wrap);
}

function showResultsCard() {
  const card = document.getElementById("results-card");
  if (card) card.classList.remove("hidden");
}

// Standard renderer for the {api_endpoint, payload_to_castle, result} shape
// returned by the demo backend routes.
function renderCastleResponse(data) {
  clearResults();
  if (data.api_endpoint) addEndpointBadge(data.api_endpoint);
  if (data.payload_to_castle) addJSONBlock("Payload sent to Castle", data.payload_to_castle);
  if (data.result !== undefined && data.result !== null) {
    addJSONBlock("Response from Castle", data.result);
  }
  showResultsCard();
}
