/* GENERATED from src/ui/client.js (bundled from src/ui/*.js) by scripts/build-client.mjs. Do not edit. */

(() => {
  // src/ui/image-panel.js
  function createImagePanel(React) {
    const h = React.createElement;
    const { useState, useEffect } = React;
    const API = "/dsh-feiyu-life/image";
    const CSS2 = `
  [data-fi-wrap]{--fi-accent:#167f78;--fi-line:rgba(127,127,127,.18);display:flex;flex-direction:column;gap:16px;padding:4px 2px 28px;color-scheme:light dark;font-size:13px;}
  [data-fi-wrap] input,[data-fi-wrap] select,[data-fi-wrap] textarea{box-sizing:border-box;max-width:100%;background:Canvas;color:CanvasText;border:1px solid rgba(127,127,127,.35);border-radius:7px;padding:6px 8px;font-size:13px;font-family:inherit;}
  [data-fi-wrap] input:focus,[data-fi-wrap] select:focus,[data-fi-wrap] textarea:focus{outline:2px solid rgba(22,127,120,.35);border-color:var(--fi-accent);outline-offset:1px;}
  [data-fi-wrap] textarea{width:100%;min-height:64px;resize:vertical;line-height:1.5;}
  [data-fi-wrap] input[type=number]{width:88px;}
  [data-fi-sec]{display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid var(--fi-line);border-radius:14px;background:rgba(127,127,127,.035);}
  [data-fi-h]{font-size:14px;font-weight:700;letter-spacing:-.01em;}
  [data-fi-sub]{margin-top:-5px;font-size:11.5px;opacity:.58;line-height:1.5;}
  [data-fi-note]{font-size:12px;opacity:.62;line-height:1.55;}
  [data-fi-row]{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  [data-fi-between]{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
  [data-fi-actions]{position:sticky;top:0;z-index:12;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;margin:0 -10px;border-bottom:1px solid var(--fi-line);background:Canvas;}
  [data-fi-status]{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
  [data-fi-stat]{padding:10px 12px;border:1px solid var(--fi-line);border-radius:11px;background:rgba(127,127,127,.055);min-width:0;}
  [data-fi-stat-k]{font-size:10.5px;opacity:.55;margin-bottom:3px;}
  [data-fi-stat-v]{font-weight:680;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  [data-fi-settings]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;}
  [data-fi-settings] [data-fi-sec][data-fi-wide]{grid-column:1/-1;}
  [data-fi-btn]{padding:5px 12px;border-radius:7px;border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.08);color:inherit;cursor:pointer;font-size:13px;}
  [data-fi-btn]:hover{background:rgba(127,127,127,.16);}
  [data-fi-btn][disabled]{opacity:.45;cursor:default;}
  [data-fi-btn][data-primary]{background:var(--fi-accent);border-color:var(--fi-accent);color:white;font-weight:650;}
  [data-fi-grid]{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px;}
  [data-fi-photo]{position:relative;display:block;padding:0;overflow:hidden;border:1px solid var(--fi-line);border-radius:11px;background:rgba(127,127,127,.06);color:inherit;text-align:left;cursor:zoom-in;}
  [data-fi-photo]:hover{border-color:rgba(22,127,120,.55);transform:translateY(-1px);box-shadow:0 8px 20px rgba(0,0,0,.08);}
  [data-fi-photo] img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:rgba(127,127,127,.08);}
  [data-fi-photo-meta]{display:block;padding:7px 8px;font-size:10.5px;line-height:1.35;opacity:.68;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  [data-fi-chip]{font-size:12px;padding:2px 8px;border-radius:999px;background:rgba(127,127,127,.14);}
  [data-fi-chip][data-ok]{background:rgba(60,180,110,.18);}
  [data-fi-chip][data-bad]{background:rgba(230,90,80,.18);}
  [data-fi-msg]{font-size:12px;min-height:16px;opacity:.75;}
  [data-fi-preview]{display:block;max-width:min(100%,520px);max-height:520px;object-fit:contain;border-radius:10px;border:1px solid rgba(127,127,127,.3);cursor:zoom-in;}
  [data-fi-lightbox]{position:fixed;inset:0;z-index:10000;display:grid;grid-template-columns:64px minmax(0,1fr) 64px;grid-template-rows:56px minmax(0,1fr) 104px;align-items:center;background:rgba(6,14,13,.88);backdrop-filter:blur(12px);color:white;}
  [data-fi-lightbox-img]{grid-column:2;grid-row:2;display:block;max-width:100%;max-height:calc(100vh - 180px);margin:auto;object-fit:contain;border-radius:10px;box-shadow:0 18px 70px rgba(0,0,0,.38);}
  [data-fi-lightbox-close]{position:absolute;right:18px;top:14px;width:38px;height:38px;border:1px solid rgba(255,255,255,.2);border-radius:50%;background:rgba(0,0,0,.28);color:white;font-size:24px;cursor:pointer;}
  [data-fi-lightbox-nav]{grid-row:2;width:42px;height:58px;margin:auto;border:0;border-radius:10px;background:rgba(255,255,255,.10);color:white;font-size:30px;cursor:pointer;}
  [data-fi-lightbox-nav='prev']{grid-column:1;}[data-fi-lightbox-nav='next']{grid-column:3;}
  [data-fi-lightbox-nav][disabled]{visibility:hidden;}
  [data-fi-lightbox-caption]{grid-column:1/-1;grid-row:3;text-align:center;font-size:12px;line-height:1.55;padding:8px 70px;overflow:hidden;}
  [data-fi-lightbox-caption] strong{display:block;font-size:13px;font-weight:650;color:white;}
  [data-fi-lightbox-caption] span{display:block;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  @media(max-width:760px){[data-fi-status]{grid-template-columns:repeat(2,minmax(0,1fr));}[data-fi-settings]{grid-template-columns:1fr;}[data-fi-settings] [data-fi-sec][data-fi-wide]{grid-column:auto;}[data-fi-grid]{grid-template-columns:repeat(2,minmax(0,1fr));}[data-fi-lightbox]{grid-template-columns:46px minmax(0,1fr) 46px;}[data-fi-lightbox-caption]{padding:0 20px;}}
  `;
    function Label(props) {
      return h(
        "label",
        { style: { display: "flex", flexDirection: "column", gap: 4 } },
        h("span", { style: { fontSize: 12, opacity: 0.7 } }, props.label),
        props.children
      );
    }
    function Panel() {
      const [status, setStatus] = useState(null);
      const [config, setConfig] = useState(null);
      const [savedConfig, setSavedConfig] = useState(null);
      const [message, setMessage] = useState("");
      const [busy, setBusy] = useState(false);
      const [draft, setDraft] = useState({ type: "character" });
      const [result, setResult] = useState(null);
      const [models, setModels] = useState([]);
      const [modelNote, setModelNote] = useState("");
      const [manual, setManual] = useState(false);
      const [galleryLimit, setGalleryLimit] = useState(8);
      const [lightbox, setLightbox] = useState(null);
      const photos = status && status.photos || [];
      const dirty = Boolean(config && savedConfig && JSON.stringify(config) !== JSON.stringify(savedConfig));
      const loadModels = async (force) => {
        setModelNote("\u62C9\u53D6\u4E2D\u2026");
        try {
          const r = await fetch(`${API}/models${force ? "?f=1" : ""}`, { credentials: "same-origin" });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || "\u62C9\u4E0D\u5230\u6A21\u578B\u5217\u8868");
          setModels(d.models || []);
          setModelNote(d.modelError ? "\u6CA1\u62C9\u5230\uFF0C\u5148\u7528\u5185\u7F6E\u540D\u5355\uFF1A" + String(d.modelError).slice(0, 80) : `${(d.models || []).length} \u4E2A\u53EF\u9009${d.cached ? "\uFF08\u7F13\u5B58 10 \u5206\u949F\uFF09" : ""}`);
        } catch (e) {
          setModels([]);
          setModelNote("\u62C9\u53D6\u5931\u8D25\uFF1A" + String(e && e.message || e).slice(0, 100));
        }
      };
      const load = async (preserveConfig = false, silent = false) => {
        try {
          const r = await fetch(`${API}/state`, { credentials: "same-origin" });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || "\u8BFB\u4E0D\u5230\u72B6\u6001");
          setStatus(d);
          if (!preserveConfig) {
            setConfig(d.config);
            setSavedConfig(clone(d.config));
          }
        } catch (e) {
          if (!silent) setMessage("\u8BFB\u53D6\u5931\u8D25\uFF1A" + String(e.message || e));
        }
      };
      useEffect(() => {
        load();
      }, []);
      useEffect(() => {
        loadModels();
      }, []);
      useEffect(() => {
        const refresh = () => {
          if (!document.hidden) load(true, true);
        };
        const timer = window.setInterval(refresh, 3e4);
        document.addEventListener("visibilitychange", refresh);
        return () => {
          window.clearInterval(timer);
          document.removeEventListener("visibilitychange", refresh);
        };
      }, [dirty]);
      useEffect(() => {
        const warn = (e) => {
          if (dirty) {
            e.preventDefault();
            e.returnValue = "";
          }
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
      }, [dirty]);
      useEffect(() => {
        if (!lightbox) return void 0;
        const before = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e) => {
          if (e.key === "Escape") setLightbox(null);
          const index = photos.findIndex((p) => p.name === lightbox.name);
          if (e.key === "ArrowLeft" && index > 0) setLightbox(photos[index - 1]);
          if (e.key === "ArrowRight" && index >= 0 && index < photos.length - 1) setLightbox(photos[index + 1]);
        };
        document.addEventListener("keydown", onKey);
        return () => {
          document.body.style.overflow = before;
          document.removeEventListener("keydown", onKey);
        };
      }, [lightbox, photos]);
      const edit = (k) => (e) => setConfig((prev) => ({ ...prev, [k]: e && e.target ? e.target.value : e }));
      const editNum = (k) => (e) => setConfig((prev) => ({ ...prev, [k]: Number(e.target.value) }));
      const editCheck = (k) => (e) => setConfig((prev) => ({ ...prev, [k]: Boolean(e.target.checked) }));
      const save = async () => {
        setBusy(true);
        setMessage("\u4FDD\u5B58\u4E2D\u2026");
        try {
          const r = await fetch(`${API}/save`, {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ config })
          });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || "\u4FDD\u5B58\u5931\u8D25");
          setMessage("\u5DF2\u4FDD\u5B58\uFF0C\u4E0B\u4E00\u5F20\u5C31\u6309\u65B0\u914D\u7F6E\u8D70");
          setConfig(d.config);
          setSavedConfig(clone(d.config));
          await load(false, true);
        } catch (e) {
          setMessage("\u4FDD\u5B58\u5931\u8D25\uFF1A" + String(e.message || e));
        } finally {
          setBusy(false);
        }
      };
      const shoot = async () => {
        setBusy(true);
        setMessage("\u6B63\u5728\u62CD\uFF0C\u65B9\u821F\u5927\u6982 30 \u79D2\u2026");
        setResult(null);
        try {
          const r = await fetch(`${API}/test`, {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(draft)
          });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || "\u8BD5\u62CD\u5931\u8D25");
          const name = String(d.image || "").split("/").pop();
          setResult({
            name,
            url: `${API}/file?n=${encodeURIComponent(name)}`,
            prompt: d.prompt,
            bytes: d.bytes,
            check: d.check || null,
            notes: d.notes || [],
            context: d.metadata && d.metadata.context,
            model: d.metadata && d.metadata.model,
            quality: d.metadata && d.metadata.quality
          });
          setMessage(d.check ? d.check.pass ? "\u62CD\u597D\u4E86\uFF0C\u81EA\u68C0\u8FC7\u4E86" : "\u62CD\u597D\u4E86\uFF0C\u4F46\u81EA\u68C0\u8BF4\u4E0D\u5408\u683C" : "\u62CD\u597D\u4E86");
          await load(dirty, true);
        } catch (e) {
          setMessage("\u8BD5\u62CD\u5931\u8D25\uFF1A" + String(e.message || e));
        } finally {
          setBusy(false);
        }
      };
      if (!status || !config) return h("div", { "data-fi-wrap": "" }, h("div", { "data-fi-note": "" }, message || "\u8BFB\u53D6\u4E2D\u2026"));
      const reload = async () => {
        if (dirty && !window.confirm("\u8FD8\u6709\u672A\u4FDD\u5B58\u7684\u62CD\u7167\u8BBE\u7F6E\uFF0C\u786E\u5B9A\u653E\u5F03\u5E76\u91CD\u65B0\u8BFB\u53D6\u5417\uFF1F")) return;
        await load(false, false);
        setMessage("\u5DF2\u91CD\u65B0\u8BFB\u53D6");
      };
      const photoUrl = (name, thumb = false) => `${API}/file?n=${encodeURIComponent(name)}${thumb ? "&thumb=1" : ""}`;
      const visiblePhotos = photos.slice(0, galleryLimit);
      const lightboxIndex = lightbox ? photos.findIndex((p) => p.name === lightbox.name) : -1;
      const formatPhotoTime = (time) => new Date(time).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      const photoContext = (photo) => {
        const context = photo && photo.context;
        return [context && context.location, context && context.activity].filter(Boolean).join(" \xB7 ");
      };
      return h(
        "div",
        { "data-fi-wrap": "" },
        h(
          "div",
          { "data-fi-status": "" },
          h("div", { "data-fi-stat": "" }, h("div", { "data-fi-stat-k": "" }, "\u76F8\u673A"), h("div", { "data-fi-stat-v": "" }, config.\u603B\u5F00\u5173 !== false ? "\u5DF2\u5F00\u542F" : "\u5DF2\u5173\u95ED")),
          h("div", { "data-fi-stat": "" }, h("div", { "data-fi-stat-k": "" }, "\u706B\u5C71\u65B9\u821F"), h("div", { "data-fi-stat-v": "" }, status.ark && status.ark.ok ? "\u5DF2\u8FDE\u63A5" : "\u672A\u914D\u7F6E")),
          h("div", { "data-fi-stat": "" }, h("div", { "data-fi-stat-k": "" }, "\u89D2\u8272\u53C2\u8003\u5E93"), h("div", { "data-fi-stat-v": "" }, status.hasRef ? `${status.refCount || 1} \u5F20` : "\u7F3A\u5931")),
          h("div", { "data-fi-stat": "" }, h("div", { "data-fi-stat-k": "" }, "\u4ECA\u65E5\u989D\u5EA6"), h("div", { "data-fi-stat-v": "" }, `${status.today} / ${status.limit}`))
        ),
        h(
          "div",
          { "data-fi-actions": "" },
          h("button", { "data-fi-btn": "", "data-primary": "", disabled: busy || !dirty, onClick: save }, busy ? "\u5904\u7406\u4E2D\u2026" : "\u4FDD\u5B58\u8BBE\u7F6E"),
          h("button", { "data-fi-btn": "", disabled: busy, onClick: reload }, "\u91CD\u65B0\u8BFB\u53D6"),
          dirty ? h("span", { "data-fi-chip": "" }, "\u6709\u672A\u4FDD\u5B58\u4FEE\u6539") : null,
          h("span", { "data-fi-msg": "" }, message)
        ),
        h(
          "div",
          { "data-fi-sec": "" },
          h("div", { "data-fi-h": "" }, "\u5FEB\u901F\u8BD5\u62CD"),
          h("div", { "data-fi-sub": "" }, "\u4E0D\u8FDB\u5165\u5BF9\u8BDD\uFF0C\u76F4\u63A5\u9A8C\u8BC1\u5F53\u524D\u5DF2\u4FDD\u5B58\u7684\u89D2\u8272\u548C\u751F\u56FE\u8BBE\u7F6E\u3002"),
          h(
            "div",
            { "data-fi-row": "" },
            h(Label, { label: "\u7C7B\u578B" }, h(
              "select",
              { value: draft.type, onChange: (e) => setDraft({ ...draft, type: e.target.value }) },
              h("option", { value: "character" }, "\u89D2\u8272\u751F\u6D3B\u7167"),
              h("option", { value: "scene" }, "\u53EA\u62CD\u573A\u666F")
            )),
            h("button", { "data-fi-btn": "", "data-primary": "", disabled: busy || config.\u603B\u5F00\u5173 === false, onClick: shoot }, "\u62CD\u4E00\u5F20")
          ),
          h("div", { "data-fi-note": "" }, "\u65E0\u9700\u586B\u5199\u63D0\u793A\u8BCD\uFF1A\u4EBA\u7269\u8EAB\u4EFD\u6765\u81EA\u53C2\u8003\u56FE\uFF1B\u5730\u70B9\u3001\u52A8\u4F5C\u3001\u670D\u88C5\u548C\u65F6\u95F4\u6765\u81EA\u6B64\u523B\u751F\u6D3B\u72B6\u6001\uFF1B\u53D1\u578B\u3001\u8868\u60C5\u3001\u955C\u5934\u3001\u5149\u7EBF\u4E0E\u573A\u666F\u7EC6\u8282\u7531\u6269\u5199\u6A21\u5757\u4E3A\u8FD9\u4E00\u5F20\u52A8\u6001\u8BBE\u8BA1\u3002"),
          dirty ? h("div", { "data-fi-note": "" }, "\u5F53\u524D\u6709\u672A\u4FDD\u5B58\u8BBE\u7F6E\uFF1B\u8BD5\u62CD\u4ECD\u4F7F\u7528\u4E0A\u4E00\u6B21\u4FDD\u5B58\u7684\u914D\u7F6E\u3002") : null,
          result && result.url ? h(
            "div",
            { "data-fi-row": "", style: { alignItems: "flex-start" } },
            h("img", { "data-fi-preview": "", src: result.url, alt: "\u8BD5\u62CD\u7ED3\u679C", onClick: () => setLightbox({ ...result, label: "\u521A\u521A\u7684\u8BD5\u62CD" }) }),
            h(
              "div",
              { style: { flex: "1 1 260px" } },
              h("div", { "data-fi-note": "" }, result.check ? result.check.pass ? "\u81EA\u68C0\u5408\u683C" : `\u81EA\u68C0\u672A\u901A\u8FC7\uFF1A${(result.check.problems || []).join("\uFF1B") || "\u753B\u9762\u6709\u95EE\u9898"}` : "\u672A\u6267\u884C\u81EA\u68C0"),
              ...(result.notes || []).map((x, i) => h("div", { key: "n" + i, "data-fi-note": "" }, "\xB7 " + x)),
              h("details", null, h("summary", { "data-fi-note": "" }, "\u67E5\u770B\u5B8C\u6574\u63D0\u793A\u8BCD"), h("div", { "data-fi-note": "" }, result.prompt))
            )
          ) : null
        ),
        h(
          "div",
          { "data-fi-sec": "" },
          h(
            "div",
            { "data-fi-between": "" },
            h("div", null, h("div", { "data-fi-h": "" }, "\u6700\u8FD1\u7684\u7167\u7247"), h("div", { "data-fi-sub": "" }, `\u5171 ${photos.length} \u5F20\uFF1B\u5217\u8868\u53EA\u52A0\u8F7D\u8F7B\u91CF\u7F29\u7565\u56FE\uFF0C\u70B9\u51FB\u67E5\u770B\u539F\u56FE\u3002`)),
            galleryLimit > 8 ? h("button", { "data-fi-btn": "", onClick: () => setGalleryLimit(8) }, "\u6536\u8D77") : null
          ),
          photos.length ? h("div", { "data-fi-grid": "" }, ...visiblePhotos.map((p, i) => h("button", {
            key: p.name,
            type: "button",
            "data-fi-photo": "",
            onClick: () => setLightbox(p),
            title: `${p.name} \xB7 ${Math.round(p.size / 1024)}KB`,
            "aria-label": `\u653E\u5927\u67E5\u770B ${formatPhotoTime(p.time)} \u7684\u7167\u7247`
          }, h("img", {
            src: photoUrl(p.name, true),
            alt: p.name,
            loading: i < 4 ? "eager" : "lazy",
            decoding: "async"
          }), h("span", { "data-fi-photo-meta": "" }, `${formatPhotoTime(p.time)}${photoContext(p) ? " \xB7 " + photoContext(p) : ""}`)))) : h("div", { "data-fi-note": "" }, "\u8FD8\u6CA1\u6709\u7167\u7247\u3002"),
          galleryLimit < photos.length ? h("button", { "data-fi-btn": "", onClick: () => setGalleryLimit((n) => Math.min(n + 8, photos.length)) }, `\u518D\u663E\u793A ${Math.min(8, photos.length - galleryLimit)} \u5F20`) : null
        ),
        h(
          "div",
          { "data-fi-settings": "" },
          h(
            "div",
            { "data-fi-sec": "" },
            h("div", { "data-fi-h": "" }, "\u57FA\u7840\u4E0E\u6A21\u578B"),
            h("div", { "data-fi-sub": "" }, "\u63A7\u5236\u76F8\u673A\u662F\u5426\u53EF\u7528\u3001Seedream \u6A21\u578B\u548C\u89D2\u8272\u53C2\u8003\u56FE\u3002"),
            h("label", { "data-fi-row": "" }, h("input", { type: "checkbox", checked: config.\u603B\u5F00\u5173 !== false, onChange: editCheck("\u603B\u5F00\u5173") }), h("span", null, "\u542F\u7528\u62CD\u7167\u5DE5\u5177")),
            h(Label, { label: "\u4E3B\u6A21\u578B" }, h(
              "div",
              { "data-fi-row": "" },
              manual || !models.length ? h("input", { value: config.\u6A21\u578B || "", onChange: edit("\u6A21\u578B"), placeholder: "\u6A21\u578B id", style: { width: 300 } }) : h(
                "select",
                {
                  value: models.includes(config.\u6A21\u578B) ? config.\u6A21\u578B : "__keep",
                  style: { width: 300 },
                  onChange: (e) => {
                    const v = e.target.value;
                    if (v === "__custom") {
                      setManual(true);
                      return;
                    }
                    if (v !== "__keep") setConfig((prev) => ({ ...prev, \u6A21\u578B: v }));
                  }
                },
                ...models.includes(config.\u6A21\u578B) ? [] : [h("option", { key: "__keep", value: "__keep" }, `\u5F53\u524D\uFF1A${config.\u6A21\u578B || "(\u7A7A)"}`)],
                ...models.map((id) => h("option", { key: id, value: id }, id)),
                h("option", { key: "__custom", value: "__custom" }, "\u624B\u52A8\u586B\u5199\u2026")
              ),
              h("button", { "data-fi-btn": "", onClick: () => loadModels(true) }, "\u5237\u65B0\u5217\u8868"),
              manual ? h("button", { "data-fi-btn": "", onClick: () => setManual(false) }, "\u8FD4\u56DE\u5217\u8868") : null
            )),
            h(Label, { label: "\u5907\u7528\u6A21\u578B" }, h("input", { value: config.\u5907\u7528\u6A21\u578B || "", onChange: edit("\u5907\u7528\u6A21\u578B"), style: { width: "100%" } })),
            h(Label, { label: "\u4EBA\u7269\u53C2\u8003\u56FE\u6587\u4EF6 / \u76EE\u5F55\uFF08\u552F\u4E00\u4EBA\u7269\u8F93\u5165\uFF0C\u6700\u591A 10 \u5F20\uFF09" }, h("textarea", { value: config.\u53C2\u8003\u56FE || "", onChange: edit("\u53C2\u8003\u56FE"), placeholder: "~/.dsh/feiyu-life-image/\u89D2\u8272\u8BBE\u5B9A\n\u4E5F\u53EF\u4EE5\u9010\u884C\u586B\u5199\u6B63\u9762\u3001\u4FA7\u9762\u3001\u80CC\u9762\u56FE\u7247", style: { width: "100%" } })),
            h("div", { "data-fi-note": "" }, status.hasRef ? `\u5DF2\u8BC6\u522B\uFF1A${(status.refNames || []).join("\u3001")}` : "\u7559\u7A7A\u4F7F\u7528\u63D2\u4EF6\u5185\u7F6E\u7684\u9AD8\u6E05\u6B63\u9762\u56FE\u4E0E\u4E09\u89C6\u56FE\uFF1B\u586B\u5199\u6587\u4EF6\u6216\u76EE\u5F55\u540E\u4F1A\u5B8C\u6574\u66FF\u6362\u5185\u7F6E\u53C2\u8003\u5E93\u3002\u652F\u6301 PNG\u3001JPEG\u3001WebP\u3002"),
            h("div", { "data-fi-note": "" }, modelNote ? `\u6A21\u578B\u5217\u8868\uFF1A${modelNote}` : "\u6A21\u578B\u5217\u8868\u4F1A\u4ECE\u65B9\u821F\u5B9E\u65F6\u8BFB\u53D6\u3002")
          ),
          h(
            "div",
            { "data-fi-sec": "" },
            h("div", { "data-fi-h": "" }, "\u751F\u6210\u8D28\u91CF"),
            h("div", { "data-fi-sub": "" }, "\u9ED8\u8BA4\u4F7F\u7528 Seedream \u6807\u51C6\u8D28\u91CF\u6A21\u5F0F\uFF1B2K \u66F4\u6E05\u695A\uFF0C1.5K \u66F4\u7701\u65F6\u3002"),
            h(Label, { label: "\u8F93\u51FA\u6E05\u6670\u5EA6" }, h(
              "select",
              { value: config.\u6E05\u6670\u5EA6 || "2K", onChange: edit("\u6E05\u6670\u5EA6") },
              h("option", { value: "2K" }, "2K \xB7 \u7EC6\u8282\u4F18\u5148"),
              h("option", { value: "1.5K" }, "1.5K \xB7 \u901F\u5EA6\u4F18\u5148")
            )),
            h("div", { "data-fi-note": "" }, "\u63D0\u793A\u8BCD\u59CB\u7EC8\u7531\u63D2\u4EF6\u6CE8\u5165\u5E76\u4F18\u5148\u4F7F\u7528\u6A21\u578B\u6269\u5199\uFF1B\u6A21\u578B\u4E0D\u53EF\u7528\u65F6\u81EA\u52A8\u4F7F\u7528\u52A8\u6001\u672C\u5730\u515C\u5E95\u3002"),
            h("label", { "data-fi-row": "" }, h("input", { type: "checkbox", checked: config.\u51FA\u56FE\u81EA\u68C0 !== false, onChange: editCheck("\u51FA\u56FE\u81EA\u68C0") }), h("span", null, "\u51FA\u56FE\u540E\u68C0\u67E5\u89D2\u8272\u3001\u80A2\u4F53\u548C\u6C34\u5370")),
            h(
              "div",
              { "data-fi-row": "" },
              h(Label, { label: "\u6700\u591A\u91CD\u62CD" }, h("input", { type: "number", value: config.\u81EA\u68C0\u91CD\u62CD ?? 1, min: 0, max: 2, onChange: editNum("\u81EA\u68C0\u91CD\u62CD") })),
              h(Label, { label: "\u6269\u5199/\u81EA\u68C0\u8D85\u65F6\uFF08\u79D2\uFF09" }, h("input", { type: "number", min: 10, max: 300, value: config.\u6A21\u578B\u8D85\u65F6\u79D2, onChange: editNum("\u6A21\u578B\u8D85\u65F6\u79D2") })),
              h(Label, { label: "\u751F\u56FE/\u4E0B\u8F7D\u8D85\u65F6\uFF08\u79D2\uFF09" }, h("input", { type: "number", min: 30, max: 600, value: config.\u751F\u56FE\u8D85\u65F6\u79D2, onChange: editNum("\u751F\u56FE\u8D85\u65F6\u79D2") }))
            ),
            h(Label, { label: "\u63D0\u793A\u8BCD\u515C\u5E95 Provider / \u6A21\u578B" }, h(
              "div",
              { "data-fi-row": "" },
              h("input", { value: config.\u515C\u5E95Provider || "", onChange: edit("\u515C\u5E95Provider"), placeholder: "deepseek-official" }),
              h("input", { value: config.\u515C\u5E95\u6A21\u578B || "", onChange: edit("\u515C\u5E95\u6A21\u578B"), placeholder: "deepseek-flash" })
            ))
          ),
          h(
            "div",
            { "data-fi-sec": "", "data-fi-wide": "" },
            h("div", { "data-fi-h": "" }, "\u52A8\u6001\u753B\u9762"),
            h("div", { "data-fi-sub": "" }, "\u53C2\u8003\u56FE\u540C\u65F6\u56FA\u5B9A\u4EBA\u7269\u8EAB\u4EFD\u4E0E\u63D2\u753B\u8BED\u8A00\uFF0C\u4F46\u4E0D\u56FA\u5B9A\u53D1\u578B\u3001\u8868\u60C5\u3001\u955C\u5934\u6216\u9053\u5177\u3002\u6BCF\u5F20\u7167\u7247\u90FD\u4F1A\u7ED3\u5408\u8FD9\u4E00\u523B\u7684\u751F\u6D3B\u91CD\u65B0\u6269\u5199\uFF0C\u7EC6\u8282\u6765\u81EA\u5F53\u6B21\u52A8\u4F5C\u4E0E\u73AF\u5883\u3002"),
            h(Label, { label: "\u753B\u5E45" }, h(
              "select",
              { value: config.\u753B\u5E45 || "\u7AD6\u5E45", onChange: edit("\u753B\u5E45") },
              h("option", { value: "\u7AD6\u5E45" }, "\u7AD6\u5E45 3:4"),
              h("option", { value: "\u65B9\u5F62" }, "\u65B9\u5F62 1:1"),
              h("option", { value: "\u6A2A\u5E45" }, "\u6A2A\u5E45 4:3")
            )),
            h("div", { "data-fi-note": "" }, config.\u6E05\u6670\u5EA6 === "1.5K" ? "\u5F53\u524D\u5C3A\u5BF8\uFF1A\u7AD6\u5E45 1344\xD71792 / \u65B9\u5F62 1536\xD71536 / \u6A2A\u5E45 1792\xD71344" : "\u5F53\u524D\u5C3A\u5BF8\uFF1A\u7AD6\u5E45 1776\xD72368 / \u65B9\u5F62 2048\xD72048 / \u6A2A\u5E45 2368\xD71776")
          ),
          h(
            "div",
            { "data-fi-sec": "", "data-fi-wide": "" },
            h("div", { "data-fi-h": "" }, "\u989D\u5EA6\u4E0E\u5B58\u50A8"),
            h("div", { "data-fi-sub": "" }, "\u9650\u5236\u8C03\u7528\u9891\u7387\uFF0C\u5E76\u63A7\u5236\u7167\u7247\u5728\u672C\u673A\u4FDD\u7559\u591A\u4E45\u3002"),
            h(
              "div",
              { "data-fi-row": "" },
              h(Label, { label: "\u6BCF\u65E5\u4E0A\u9650" }, h("input", { type: "number", value: config.\u6BCF\u65E5\u4E0A\u9650, onChange: editNum("\u6BCF\u65E5\u4E0A\u9650") })),
              h(Label, { label: "\u6700\u77ED\u95F4\u9694\uFF08\u79D2\uFF09" }, h("input", { type: "number", value: config.\u6700\u77ED\u95F4\u9694\u79D2, onChange: editNum("\u6700\u77ED\u95F4\u9694\u79D2") })),
              h(Label, { label: "\u7167\u7247\u4FDD\u7559\uFF08\u5929\uFF09" }, h("input", { type: "number", min: 1, max: 3650, value: config.\u7167\u7247\u4FDD\u7559\u5929\u6570, onChange: editNum("\u7167\u7247\u4FDD\u7559\u5929\u6570") })),
              h(Label, { label: "\u5B58\u56FE\u76EE\u5F55\uFF08\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4\u76EE\u5F55\uFF09" }, h("input", { value: config.\u5B58\u56FE\u76EE\u5F55 || "", onChange: edit("\u5B58\u56FE\u76EE\u5F55"), style: { width: 360 } }))
            )
          )
        ),
        lightbox ? h(
          "div",
          { "data-fi-lightbox": "", role: "dialog", "aria-modal": "true", onClick: (e) => {
            if (e.target === e.currentTarget) setLightbox(null);
          } },
          h("button", { "data-fi-lightbox-close": "", "aria-label": "\u5173\u95ED\u9884\u89C8", onClick: () => setLightbox(null) }, "\xD7"),
          h("button", { "data-fi-lightbox-nav": "prev", "aria-label": "\u4E0A\u4E00\u5F20", disabled: lightboxIndex <= 0, onClick: () => setLightbox(photos[lightboxIndex - 1]) }, "\u2039"),
          h("img", { "data-fi-lightbox-img": "", src: photoUrl(lightbox.name), alt: lightbox.name || "\u7167\u7247\u9884\u89C8" }),
          h("button", { "data-fi-lightbox-nav": "next", "aria-label": "\u4E0B\u4E00\u5F20", disabled: lightboxIndex < 0 || lightboxIndex >= photos.length - 1, onClick: () => setLightbox(photos[lightboxIndex + 1]) }, "\u203A"),
          h(
            "div",
            { "data-fi-lightbox-caption": "" },
            h("strong", null, lightbox.label || `${lightbox.time ? formatPhotoTime(lightbox.time) : "\u7167\u7247"}${photoContext(lightbox) ? " \xB7 " + photoContext(lightbox) : ""}`),
            lightbox.context && lightbox.context.outfit ? h("span", null, `\u7A7F\u7740\uFF1A${lightbox.context.outfit}`) : null,
            lightbox.prompt ? h("span", { title: lightbox.prompt }, lightbox.prompt) : null
          )
        ) : null
      );
    }
    return { Panel, CSS: CSS2 };
  }

  // src/ui/constants.js
  var phoneOptions = ["\u5728\u624B", "\u9759\u97F3", "\u5728\u5E8A\u5934", "\u4E0D\u5728\u624B\u8FB9"];
  var routineTables = [["\u65E5\u5E38", "\u65E5\u5E38\uFF08\u6709\u8BFE\u7684\u65E5\u5B50\uFF09"], ["\u665A\u8D77", "\u665A\u8D77\uFF08\u5468\u56DB\u90A3\u79CD\uFF09"], ["\u5047\u671F", "\u5047\u671F"], ["\u5907\u8003", "\u5907\u8003\uFF08\u8003\u8BD5\u5468\uFF09"]];
  var wardrobeLabels = [["sleep", "\u7761\u89C9"], ["bath", "\u6D17\u6FA1"], ["class", "\u4E0A\u8BFE"], ["home", "\u5728\u5BB6"], ["out", "\u51FA\u95E8"], ["eat", "\u5403\u996D"]];
  var weekdayNames = ["", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D", "\u5468\u65E5"];
  var UI_ASSET_VERSION = "2.6.3";
  var SETTINGS_BACKUP_VERSIONS = [1, 2];
  var tabs = [["now", "\u6B64\u523B"], ["life", "\u751F\u6D3B"], ["inner", "\u5185\u5728"], ["proactive", "\u4E3B\u52A8"], ["world", "\u4E16\u754C"], ["camera", "\u76F8\u673A"], ["data", "\u6570\u636E"]];
  var groupSections = {
    now: [],
    life: [["day", "\u4F5C\u606F"], ["week", "\u8BFE\u8868"], ["year", "\u5E74\u5EA6"], ["body", "\u8EAB\u4F53"]],
    inner: [["persona", "\u4EBA\u683C"], ["inner", "\u5185\u5728"], ["continuity", "\u8FDE\u7EED\u6027"]],
    proactive: [["share", "\u5206\u4EAB"]],
    world: [["map", "\u5730\u56FE"], ["replay", "\u56DE\u653E"]],
    camera: [["photo", "\u7167\u7247"]],
    data: [["data", "\u6570\u636E"]]
  };
  var firstTabForGroup = (group) => groupSections[group]?.[0]?.[0] || group;
  var isSupportedSettingsBackup = (value) => Boolean(
    value && value.format === "dsh-feiyu-life-settings" && SETTINGS_BACKUP_VERSIONS.includes(Number(value.version)) && value.life && value.camera && (Number(value.version) === 1 || value.mind && typeof value.mind === "object" && !Array.isArray(value.mind))
  );

  // src/ui/styles.js
  var CSS = `
[data-fl-wrap]{--fl-accent:#167f78;--fl-accent-soft:rgba(22,127,120,.12);--fl-warm:#d97732;--fl-line:rgba(127,127,127,.18);display:flex;flex-direction:column;gap:16px;padding:6px 2px 28px;color-scheme:light dark;font-size:13px;max-width:1080px;}
[data-fl-wrap] select{background:Canvas;color:CanvasText;}
[data-fl-wrap] select option{background:Canvas;color:CanvasText;}
[data-fl-sec]{display:flex;flex-direction:column;gap:8px;}
[data-fl-hero]{position:relative;overflow:hidden;padding:20px;border:1px solid var(--fl-line);border-radius:16px;background:linear-gradient(135deg,var(--fl-accent-soft),rgba(217,119,50,.08));}
[data-fl-hero]::after{content:'\u25CC';position:absolute;right:18px;top:-22px;font-size:92px;color:var(--fl-accent);opacity:.10;}
[data-fl-title]{font-size:22px;font-weight:750;letter-spacing:-.02em;}
[data-fl-subtitle]{margin-top:5px;font-size:12.5px;opacity:.66;line-height:1.55;}
[data-fl-stats]{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px;}
[data-fl-stat]{min-width:0;padding:9px 10px;border-radius:10px;background:rgba(255,255,255,.46);border:1px solid rgba(127,127,127,.12);}
@media (prefers-color-scheme:dark){[data-fl-stat]{background:rgba(0,0,0,.16);}}
[data-fl-stat-k]{font-size:10.5px;opacity:.55;margin-bottom:3px;}
[data-fl-stat-v]{font-size:12.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
[data-fl-actions]{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 0;background:Canvas;border-bottom:1px solid var(--fl-line);}
[data-fl-dirty]{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--fl-warm);}
[data-fl-dirty]::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;}
[data-fl-h]{font-size:13px;font-weight:650;opacity:.9;padding-top:10px;border-top:1px solid var(--fl-line);}
[data-fl-note]{font-size:12px;opacity:.62;line-height:1.55;}
[data-fl-row]{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
[data-fl-tabs]{display:flex;gap:6px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid rgba(127,127,127,.2);}
[data-fl-tab]{padding:5px 12px;border-radius:7px;border:1px solid transparent;background:transparent;color:inherit;font-size:13px;cursor:pointer;opacity:.72;}
[data-fl-tab]:hover{background:rgba(127,127,127,.10);opacity:1;}
[data-fl-subtabs]{display:flex;gap:4px;flex-wrap:wrap;margin-top:-2px;}
[data-fl-subtab]{padding:4px 10px;border-radius:6px;border:1px solid transparent;background:transparent;color:inherit;font-size:12.5px;cursor:pointer;opacity:.68;}
[data-fl-subtab]:hover{background:rgba(127,127,127,.10);opacity:1;}
[data-fl-subtab][data-fl-on]{background:rgba(127,127,127,.13);border-color:rgba(127,127,127,.2);opacity:1;font-weight:600;}
[data-fl-tab][data-fl-on]{background:var(--fl-accent-soft);border-color:rgba(22,127,120,.35);color:var(--fl-accent);opacity:1;font-weight:650;}
[data-fl-input]{padding:5px 8px;border-radius:7px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;font-size:12.5px;}
[data-fl-input]:focus{outline:2px solid rgba(22,127,120,.35);border-color:var(--fl-accent);outline-offset:1px;}
[data-fl-btn]{padding:6px 12px;border-radius:7px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;font-size:13px;cursor:pointer;}
[data-fl-btn]:hover{background:rgba(127,127,127,.12);}
[data-fl-btn][disabled]{opacity:.5;cursor:default;}
[data-fl-btn][data-fl-main]{border-color:var(--fl-accent);background:var(--fl-accent);color:white;font-weight:650;}
[data-fl-btn][data-fl-main]:hover{filter:brightness(.95);background:var(--fl-accent);}
[data-fl-del]{padding:3px 8px;border-radius:6px;border:1px solid transparent;background:transparent;color:rgba(210,90,90,.9);cursor:pointer;font-size:12px;}
[data-fl-del]:hover{background:rgba(210,90,90,.12);}
[data-fl-msg]{font-size:12px;opacity:.8;min-height:16px;}
[data-fl-warn]{padding:9px 11px;border-radius:9px;border:1px solid rgba(217,119,50,.32);background:rgba(217,119,50,.09);font-size:12px;line-height:1.55;}
[data-fl-prev]{padding:10px 12px;border-radius:10px;background:rgba(127,127,127,.08);white-space:pre-wrap;line-height:1.7;font-size:13px;}
[data-fl-why]{display:flex;gap:6px;flex-wrap:wrap;}
[data-fl-chip]{padding:2px 8px;border-radius:999px;background:rgba(127,127,127,.12);font-size:11.5px;opacity:.85;}
[data-fl-table]{width:100%;border-collapse:collapse;}
[data-fl-table] th{font-weight:500;font-size:11.5px;opacity:.55;text-align:left;padding:2px 6px;}
[data-fl-table] td{padding:3px 6px;vertical-align:middle;}
[data-fl-table] tr+tr td{border-top:1px solid rgba(127,127,127,.10);}
[data-fl-num]{width:78px;}
[data-fl-narrow]{width:92px;}
[data-fl-wide]{width:100%;min-width:220px;}
[data-fl-empty]{font-size:12px;opacity:.55;padding:6px 2px;}
[data-fl-cont-grid]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
[data-fl-cont-card]{padding:12px;border:1px solid var(--fl-line);border-radius:12px;background:rgba(127,127,127,.045);}
[data-fl-cont-card] strong{display:block;margin-bottom:4px;}
[data-fl-cont-meta]{font-size:11px;opacity:.58;line-height:1.5;}
[data-fl-meter]{height:7px;margin-top:7px;overflow:hidden;border-radius:999px;background:rgba(127,127,127,.14);}
[data-fl-meter]>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--fl-warm),var(--fl-accent));}
[data-fl-event][data-status='failed']{border-color:rgba(210,70,70,.28);}
[data-fl-event-type]{display:inline-flex;margin-left:6px;padding:1px 6px;border-radius:999px;background:var(--fl-accent-soft);color:var(--fl-accent);font-size:10px;}
[data-fl-due]{display:inline-flex;margin-top:5px;padding:2px 7px;border-radius:999px;background:rgba(217,119,50,.12);color:var(--fl-warm);font-size:10.5px;font-weight:650;}
[data-fl-due][data-state='overdue']{background:rgba(210,70,70,.13);color:#c94e4e;}
[data-fl-sync]{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid var(--fl-line);border-radius:11px;background:var(--fl-accent-soft);}
@media(max-width:720px){[data-fl-tabs]{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;}[data-fl-subtabs]{flex-wrap:nowrap;overflow-x:auto;}[data-fl-cont-grid]{grid-template-columns:1fr;}}
[data-fl-tl]{margin-top:4px;display:flex;flex-direction:column;gap:5px;}
[data-fl-tl-row]{display:flex;align-items:center;gap:8px;}
[data-fl-tl-time]{flex:0 0 100px;text-align:right;font-size:10.5px;opacity:.6;font-variant-numeric:tabular-nums;}
[data-fl-ticks]{position:relative;flex:0 0 58%;height:16px;font-size:10px;opacity:.55;}
[data-fl-ticks]>span{position:absolute;transform:translateX(-50%);}
[data-fl-now-mark]{position:absolute;transform:translateX(-50%);top:-1px;color:#ff5252;font-weight:600;white-space:nowrap;}
[data-fl-track]{position:relative;flex:0 0 58%;height:16px;border-radius:5px;background:rgba(127,127,127,.10);}
[data-fl-seg]{position:absolute;top:0;bottom:0;border-radius:5px;min-width:2px;}
[data-fl-seg][data-fl-src='plan']{background:#8b93a1;}
[data-fl-seg][data-fl-src='adjust']{background:#e08a1e;}
[data-fl-seg][data-fl-src='travel']{background:#4b88d1;}
[data-fl-tl-what]{flex:1;font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
[data-fl-tl-src]{font-style:normal;font-size:10px;opacity:.75;margin-left:6px;padding:1px 6px;border-radius:999px;background:rgba(127,127,127,.14);}
[data-fl-tl-row][data-fl-cur] [data-fl-seg]{box-shadow:0 0 0 2px rgba(255,82,82,.75);}
[data-fl-tl-row][data-fl-cur] [data-fl-tl-what]{font-weight:600;}
[data-fl-legend]{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;opacity:.7;margin-top:6px;}
[data-fl-lg]{display:inline-flex;align-items:center;gap:4px;}
[data-fl-lg]::before{content:'';width:10px;height:10px;border-radius:3px;display:inline-block;}
[data-fl-lg][data-fl-src='plan']::before{background:#8b93a1;}
[data-fl-lg][data-fl-src='adjust']::before{background:#e08a1e;}
[data-fl-lg][data-fl-src='travel']::before{background:#4b88d1;}
[data-fl-map]{position:relative;isolation:isolate;width:100%;aspect-ratio:16/9;min-height:380px;overflow:visible;border:1px solid rgba(81,125,108,.22);border-radius:24px;background:radial-gradient(ellipse at 12% 18%,rgba(255,255,255,.86),transparent 24%),radial-gradient(ellipse at 78% 14%,rgba(255,244,190,.48),transparent 24%),linear-gradient(145deg,#edf4df 0%,#e2f0dc 48%,#d9ebe2 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.58),inset 0 -28px 60px rgba(85,138,114,.08),0 14px 34px rgba(40,79,68,.10);}
[data-fl-map]::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;background-image:radial-gradient(circle at 10% 20%,rgba(88,137,91,.10) 0 1.2px,transparent 1.4px),radial-gradient(circle at 70% 64%,rgba(255,255,255,.34) 0 1px,transparent 1.2px);background-size:22px 22px,18px 18px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.72),rgba(0,0,0,.18));}
[data-fl-map]::after{content:'';position:absolute;inset:8px;z-index:0;pointer-events:none;border:1px dashed rgba(89,133,112,.18);border-radius:18px;}
@media(prefers-color-scheme:dark){[data-fl-map]{border-color:rgba(145,195,171,.20);background:radial-gradient(ellipse at 12% 18%,rgba(103,148,129,.18),transparent 25%),radial-gradient(ellipse at 78% 14%,rgba(189,167,89,.12),transparent 25%),linear-gradient(145deg,#21342d 0%,#1d312d 52%,#1c2c31 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.04),inset 0 -28px 60px rgba(4,17,15,.24),0 14px 34px rgba(0,0,0,.18);}}
[data-fl-map-layers]{position:absolute;inset:0;z-index:0;overflow:hidden;border-radius:inherit;pointer-events:none;}
[data-fl-map-layer]{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;}
[data-fl-map-layer='base']{z-index:0;opacity:.68;}
[data-fl-map-layer='anime']{z-index:1;opacity:.94;mix-blend-mode:normal;}
[data-fl-map-layer='buildings']{z-index:2;opacity:.98;filter:drop-shadow(0 3px 2px rgba(65,85,75,.11));}
[data-fl-map][data-map-style='xueyuan-road']::before{z-index:2;opacity:.18;}
[data-fl-map][data-map-style='xueyuan-road'] [data-fl-map-scenery]{display:none;}
@media(prefers-color-scheme:dark){[data-fl-map-layer='base']{opacity:.18;filter:brightness(.30) saturate(.52) hue-rotate(12deg);}[data-fl-map-layer='anime']{opacity:.90;mix-blend-mode:normal;filter:brightness(.72) saturate(.95);}[data-fl-map-layer='buildings']{opacity:.58;filter:brightness(.72) saturate(.74) drop-shadow(0 3px 2px rgba(0,0,0,.22));}}
[data-fl-map-scenery]{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;border-radius:inherit;}
[data-fl-scenery]{position:absolute;display:block;}
[data-fl-scenery='hill-a']{left:-5%;top:32%;width:28%;height:43%;border-radius:45% 55% 58% 42%;transform:rotate(-9deg);background:linear-gradient(145deg,rgba(153,199,132,.22),rgba(111,171,133,.12));border:1px solid rgba(105,159,117,.10);}
[data-fl-scenery='hill-b']{right:-6%;top:-8%;width:34%;height:45%;border-radius:40% 60% 47% 53%;transform:rotate(12deg);background:linear-gradient(145deg,rgba(166,207,139,.17),rgba(109,170,143,.10));border:1px solid rgba(105,159,117,.09);}
[data-fl-scenery='pond']{right:6%;bottom:5%;width:19%;height:21%;border-radius:58% 42% 54% 46% / 47% 55% 45% 53%;transform:rotate(-6deg);background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.50),transparent 18%),linear-gradient(145deg,rgba(140,209,210,.55),rgba(86,169,184,.38));border:3px solid rgba(255,255,255,.42);box-shadow:0 0 0 1px rgba(69,139,151,.16),inset 0 0 18px rgba(255,255,255,.28);}
[data-fl-scenery='plaza']{left:37%;top:42%;width:20%;height:23%;border-radius:50%;transform:rotate(5deg);background:repeating-linear-gradient(45deg,rgba(255,255,255,.20) 0 7px,rgba(187,160,115,.08) 7px 14px),rgba(238,224,188,.40);border:1px solid rgba(169,145,103,.12);}
@media(prefers-color-scheme:dark){[data-fl-scenery='hill-a'],[data-fl-scenery='hill-b']{opacity:.55;}[data-fl-scenery='pond']{background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.14),transparent 18%),linear-gradient(145deg,rgba(71,145,151,.46),rgba(46,104,126,.42));border-color:rgba(170,218,212,.14);}[data-fl-scenery='plaza']{opacity:.46;}}
[data-fl-map-badge]{position:absolute;left:14px;top:13px;z-index:6;display:flex;align-items:center;gap:7px;padding:5px 10px 5px 7px;border:1px solid rgba(95,132,112,.18);border-radius:999px;background:rgba(255,255,255,.72);box-shadow:0 5px 15px rgba(45,83,66,.07);backdrop-filter:blur(8px);color:#3f6655;font-size:10px;letter-spacing:.03em;}
[data-fl-brand-mark]{display:block;flex:none;}
[data-fl-map-logo]{display:block;width:22px;height:22px;border-radius:50%;object-fit:contain;box-sizing:border-box;}
@media(prefers-color-scheme:dark){[data-fl-map-badge]{background:rgba(25,43,38,.70);border-color:rgba(151,199,178,.14);color:#b9d7c9;}}
[data-fl-map-attribution]{position:absolute;right:12px;bottom:9px;z-index:6;padding:2px 6px;border-radius:6px;background:rgba(255,255,255,.70);color:#4c675b;font-size:8px;line-height:1.3;text-decoration:none;backdrop-filter:blur(5px);}
@media(prefers-color-scheme:dark){[data-fl-map-attribution]{background:rgba(14,28,24,.66);color:#a8c7b9;}}
[data-fl-map-lines]{position:absolute;inset:0;z-index:3;width:100%;height:100%;overflow:visible;pointer-events:none;}
[data-fl-road]{opacity:.58;transition:opacity .2s ease;}
[data-fl-road-base]{fill:none;stroke:rgba(255,252,233,.78);stroke-width:4.2;stroke-linecap:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 1px 1px rgba(76,112,91,.12));}
[data-fl-road-mark]{fill:none;stroke:rgba(104,143,118,.32);stroke-width:1;stroke-linecap:round;stroke-dasharray:4 8;vector-effect:non-scaling-stroke;}
[data-fl-road][data-fl-road-active]{opacity:1;}
[data-fl-road][data-fl-road-active] [data-fl-road-base]{stroke:rgba(209,250,238,.96);filter:drop-shadow(0 0 4px rgba(25,153,145,.48));}
[data-fl-road][data-fl-road-active] [data-fl-road-mark]{stroke:#199b92;stroke-width:1.8;stroke-dasharray:4 5;animation:fl-road-flow .8s linear infinite;}
@keyframes fl-road-flow{to{stroke-dashoffset:-9;}}
@media(prefers-color-scheme:dark){[data-fl-road-base]{stroke:rgba(213,221,190,.30);filter:drop-shadow(0 1px 1px rgba(0,0,0,.22));}[data-fl-road-mark]{stroke:rgba(171,196,166,.34);}[data-fl-road][data-fl-road-active] [data-fl-road-base]{stroke:rgba(80,174,163,.42);}}
[data-fl-place]{--fl-place-color:#6eaa8a;--fl-place-soft:rgba(110,170,138,.30);position:absolute;z-index:5;transform:translate(-50%,-50%);width:34px;height:34px;color:var(--fl-place-color);text-align:center;filter:drop-shadow(0 3px 4px rgba(42,77,63,.16));}
[data-fl-place][data-place='dorm']{--fl-place-color:#667ab4;--fl-place-soft:rgba(108,124,180,.30);}[data-fl-place][data-place='classroom']{--fl-place-color:#b86f3e;--fl-place-soft:rgba(205,137,77,.28);}[data-fl-place][data-place='library']{--fl-place-color:#5274ad;--fl-place-soft:rgba(92,120,169,.28);}[data-fl-place][data-place='canteen']{--fl-place-color:#bd5f47;--fl-place-soft:rgba(211,113,79,.28);}[data-fl-place][data-place='shop']{--fl-place-color:#378c7c;--fl-place-soft:rgba(75,150,137,.28);}[data-fl-place][data-place='outdoor']{--fl-place-color:#518d47;--fl-place-soft:rgba(98,155,84,.28);}[data-fl-place][data-place='cafe']{--fl-place-color:#8e5f3e;--fl-place-soft:rgba(168,121,85,.28);}[data-fl-place][data-place='mall']{--fl-place-color:#88519b;--fl-place-soft:rgba(155,108,173,.28);}[data-fl-place][data-place='mcdonalds']{--fl-place-color:#d6232e;--fl-place-soft:rgba(214,35,46,.25);}
[data-fl-place-marker]{position:absolute;inset:0;display:block;color:var(--fl-place-color);transform-origin:50% 75%;transition:transform .22s ease,filter .22s ease;}
[data-fl-place-glyph]{display:block;width:34px;height:34px;overflow:visible;filter:drop-shadow(0 1px 0 rgba(255,255,255,.90)) drop-shadow(0 2px 2px rgba(35,63,54,.18));}
[data-fl-place-name]{position:absolute;left:50%;top:35px;transform:translateX(-50%);max-width:120px;color:#284d40;font-size:9px;font-weight:750;line-height:1.15;white-space:nowrap;text-shadow:-1px -1px 0 rgba(255,255,255,.96),1px -1px 0 rgba(255,255,255,.96),-1px 1px 0 rgba(255,255,255,.96),1px 1px 0 rgba(255,255,255,.96),0 2px 3px rgba(255,255,255,.92);}
[data-fl-place][data-place='classroom'] [data-fl-place-name]{left:4px;top:9px;transform:translateX(-100%);}
[data-fl-place][data-place='cafe'] [data-fl-place-name]{left:38px;top:9px;transform:none;}
[data-fl-place][data-place='mcdonalds'] [data-fl-place-name]{top:auto;bottom:35px;}
[data-fl-place][data-fl-active] [data-fl-place-marker]{transform:translateY(-2px) scale(1.16);filter:drop-shadow(0 0 7px var(--fl-place-soft));}
[data-fl-place][data-fl-active] [data-fl-place-name]{color:var(--fl-place-color);font-weight:850;}
@media(prefers-color-scheme:dark){[data-fl-place-glyph]{filter:drop-shadow(0 1px 0 rgba(230,242,234,.38)) drop-shadow(0 2px 3px rgba(0,0,0,.42));}[data-fl-place-name]{color:#d8e8df;text-shadow:-1px -1px 0 rgba(15,31,27,.95),1px -1px 0 rgba(15,31,27,.95),-1px 1px 0 rgba(15,31,27,.95),1px 1px 0 rgba(15,31,27,.95),0 2px 3px rgba(0,0,0,.85);}}
[data-fl-avatar]{position:absolute;z-index:8;transform:translate(-50%,calc(-100% - 48px));transition:left 1.2s linear,top 1.2s linear;filter:drop-shadow(0 7px 5px rgba(25,52,58,.23));}
[data-fl-avatar-motion]{position:relative;width:80px;height:80px;transform-origin:50% 100%;}
[data-fl-avatar-sprite]{width:80px;height:80px;background-color:transparent;background-image:var(--fl-avatar-image);background-size:320px 80px;background-position:0 0;background-repeat:no-repeat;background-clip:border-box;animation:fl-sprite-4 2.2s steps(1,end) infinite;}
[data-fl-avatar-motion][data-behavior='walk'] [data-fl-avatar-sprite]{animation-duration:.62s;}
[data-fl-avatar-motion][data-behavior='sleep'] [data-fl-avatar-sprite]{animation-duration:2.8s;}
[data-fl-avatar-motion][data-behavior='study'] [data-fl-avatar-sprite]{animation-duration:1.7s;}
[data-fl-avatar-motion][data-behavior='eat'] [data-fl-avatar-sprite]{animation-duration:1.25s;}
[data-fl-avatar-motion][data-behavior='phone'] [data-fl-avatar-sprite]{animation-duration:2s;}
[data-fl-avatar-motion][data-behavior='photo'] [data-fl-avatar-sprite]{animation-duration:1.6s;}
[data-fl-avatar-motion][data-behavior='bath'] [data-fl-avatar-sprite]{animation-duration:1.35s;}
[data-fl-avatar-bubble]{position:absolute;right:-9px;top:-6px;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:Canvas;border:1px solid var(--fl-line);color:var(--fl-accent);box-shadow:0 4px 12px rgba(0,0,0,.12);}
[data-fl-avatar-bubble] svg{display:block;width:17px;height:17px;}
[data-fl-avatar-label]{position:absolute;left:50%;top:calc(100% + 4px);transform:translateX(-50%);white-space:nowrap;padding:2px 7px;border-radius:999px;background:rgba(16,66,68,.82);color:#fff;font-size:10px;box-shadow:0 3px 8px rgba(0,0,0,.14);}
[data-fl-world-cards]{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
[data-fl-replay-controls]{display:grid;grid-template-columns:auto minmax(180px,1fr) auto;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--fl-line);border-radius:12px;background:rgba(127,127,127,.06);}
[data-fl-replay-controls] input[type='range']{width:100%;accent-color:var(--fl-accent);}
[data-fl-replay-time]{min-width:52px;text-align:center;font-size:15px;font-weight:750;font-variant-numeric:tabular-nums;color:var(--fl-accent);}
[data-fl-replay-empty]{padding:24px;text-align:center;border:1px dashed rgba(127,127,127,.28);border-radius:14px;font-size:12px;opacity:.65;}
[data-fl-backup-card]{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;padding:14px;border:1px solid var(--fl-line);border-radius:12px;background:rgba(127,127,127,.045);}
[data-fl-backup-title]{font-size:13px;font-weight:700;margin-bottom:4px;}
[data-fl-backup-meta]{font-size:11.5px;opacity:.62;line-height:1.55;overflow-wrap:anywhere;}
@keyframes fl-sprite-4{0%,24.99%{background-position-x:0}25%,49.99%{background-position-x:-80px}50%,74.99%{background-position-x:-160px}75%,100%{background-position-x:-240px}}
@media(prefers-reduced-motion:reduce){[data-fl-avatar]{transition:none!important;}[data-fl-avatar-sprite],[data-fl-road-mark]{animation:none!important;}[data-fl-avatar-sprite]{background-position-x:0!important;}}
@media(max-width:720px){[data-fl-tabs]{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;}[data-fl-subtabs]{flex-wrap:nowrap;overflow-x:auto;}[data-fl-stats]{grid-template-columns:repeat(2,minmax(0,1fr));}[data-fl-world-cards]{grid-template-columns:1fr;}[data-fl-map]{min-height:430px;}[data-fl-table]{display:block;overflow-x:auto;}[data-fl-tl-time]{flex-basis:78px;}[data-fl-track],[data-fl-ticks]{flex-basis:48%;}[data-fl-replay-controls]{grid-template-columns:auto 1fr;}[data-fl-replay-time]{grid-column:1/-1;grid-row:1;}}
`;

  // src/ui/app.js
  function createUI(require2) {
    const React = require2("react");
    const h = React.createElement;
    const { useState, useEffect } = React;
    const ImagePanel = createImagePanel(React);
    const API = "/dsh-feiyu-life";
    const clone2 = (x) => JSON.parse(JSON.stringify(x));
    const setPath = (obj, path, value) => {
      const out = clone2(obj);
      let cur = out;
      for (let i = 0; i < path.length - 1; i++) {
        const k = path[i];
        if (cur[k] === void 0 || cur[k] === null || typeof cur[k] !== "object") cur[k] = typeof path[i + 1] === "number" ? [] : {};
        cur = cur[k];
      }
      cur[path[path.length - 1]] = value;
      return out;
    };
    const getJson = async (url) => {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    };
    const postJson = async (url, body) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {})
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data && data.error || "HTTP " + res.status);
      return data;
    };
    function Field({ value, onChange, width, placeholder, type, step }) {
      return h("input", {
        "data-fl-input": "",
        type: type || "text",
        value: value ?? "",
        placeholder: placeholder || "",
        step,
        className: width || "",
        onChange: (e) => onChange(e.target.value)
      });
    }
    function Select({ value, onChange, options }) {
      return h("select", {
        "data-fl-input": "",
        value: value ?? options[0],
        onChange: (e) => onChange(e.target.value)
      }, options.map((o) => h("option", { key: o, value: o }, o)));
    }
    function Table({ columns, rows, render, add, addLabel, emptyLabel }) {
      return h(
        "div",
        null,
        h(
          "table",
          { "data-fl-table": "" },
          h("thead", null, h("tr", null, columns.map((c) => h("th", { key: c.k }, c.t)))),
          h("tbody", null, rows.length ? rows.map((r, i) => h("tr", { key: i }, render(r, i))) : h("tr", null, h("td", { colSpan: columns.length }, h("div", { "data-fl-empty": "" }, emptyLabel || "\u8FD8\u6CA1\u6709\u5185\u5BB9"))))
        ),
        h(
          "div",
          { "data-fl-row": "", style: { marginTop: "6px" } },
          h("button", { "data-fl-btn": "", onClick: add }, addLabel || "\u6DFB\u52A0\u4E00\u884C")
        )
      );
    }
    const clockOf = (minute) => {
      if (Math.round(minute) === 1440) return "24:00";
      const m = (Math.round(minute) % 1440 + 1440) % 1440;
      return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    };
    function replayFrameAt(frames, minute) {
      const rows = Array.isArray(frames) ? frames : [];
      let selected = rows[0] || null;
      for (const frame of rows) {
        if (frame.minute > minute) break;
        selected = frame;
      }
      return selected;
    }
    function TimelineChart({ timeline, currentMinute, cursorLabel = "\u6B64\u523B" }) {
      if (!timeline || !timeline.length) return h("div", { "data-fl-empty": "" }, "\u8FD8\u6CA1\u6709\u4ECA\u5929\u7684\u65F6\u95F4\u7EBF");
      const rows = timeline.map((x) => ({ ...x, start: Math.max(0, x.start), end: Math.min(1440, x.end) })).filter((x) => x.end > x.start);
      const active = rows.find((x) => currentMinute >= x.start && currentMinute < x.end);
      return h(
        "div",
        { "data-fl-tl": "" },
        h(
          "div",
          { "data-fl-tl-row": "" },
          h("span", { "data-fl-tl-time": "" }, ""),
          h(
            "div",
            { "data-fl-ticks": "" },
            [0, 6, 12, 18, 24].map((hh) => h("span", { key: hh, style: { left: hh / 24 * 100 + "%" } }, hh + ":00")),
            h("span", { "data-fl-now-mark": "", style: { left: Math.max(0, Math.min(1440, currentMinute)) / 1440 * 100 + "%" } }, cursorLabel + " " + clockOf(currentMinute))
          ),
          h("span", { "data-fl-tl-what": "" }, "")
        ),
        rows.map((x, i) => h(
          "div",
          {
            key: i,
            "data-fl-tl-row": "",
            "data-fl-cur": x === active ? "" : void 0
          },
          h("span", { "data-fl-tl-time": "" }, `${clockOf(x.start)}\u2013${clockOf(x.end)}`),
          h(
            "div",
            { "data-fl-track": "" },
            h("div", {
              "data-fl-seg": "",
              "data-fl-src": x.source || "plan",
              style: { left: x.start / 1440 * 100 + "%", width: (x.end - x.start) / 1440 * 100 + "%" },
              title: `${clockOf(x.start)}\u2013${clockOf(x.end)} ${x.what}\uFF08${x.source || "plan"}${x.outfit ? "\uFF0C" + x.outfit : ""}\uFF09`
            })
          ),
          h(
            "span",
            { "data-fl-tl-what": "", title: x.what },
            x.what,
            x.source && x.source !== "plan" ? h("i", { "data-fl-tl-src": "" }, x.source === "travel" ? "\u901A\u52E4" : "\u8C03\u6574") : null
          )
        )),
        h(
          "div",
          { "data-fl-legend": "" },
          h("span", { "data-fl-lg": "", "data-fl-src": "plan" }, "\u8BA1\u5212"),
          h("span", { "data-fl-lg": "", "data-fl-src": "adjust" }, "\u8C03\u6574\uFF08life_adjust\uFF09"),
          h("span", { "data-fl-lg": "", "data-fl-src": "travel" }, "\u81EA\u52A8\u901A\u52E4")
        )
      );
    }
    const iconifyGlyphs = {
      sparkles: [["path", { d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594zM20 2v4m2-2h-4" }], ["circle", { cx: "4", cy: "20", r: "2" }]],
      moon: [["path", { d: "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" }]],
      footprints: [["path", { d: "M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0m16 4v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0m-4-3h4M4 13h4" }]],
      pencil: [["path", { d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4" }]],
      utensils: [["path", { d: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20m14-7V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2zm0 0v7" }]],
      smartphone: [["rect", { width: "14", height: "20", x: "5", y: "2", rx: "2", ry: "2" }], ["path", { d: "M12 18h.01" }]],
      camera: [["path", { d: "M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" }], ["circle", { cx: "12", cy: "13", r: "3" }]],
      bath: [["path", { d: "M10 4 8 6m9 13v2M2 12h20M7 19v2M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" }]],
      bed: [["path", { d: "M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" }]],
      school: [["path", { d: "M14 21v-3a2 2 0 0 0-4 0v3m8-16.067V21M4 6l7.106-3.79a2 2 0 0 1 1.788 0L20 6" }], ["path", { d: "m6 11-3.52 2.147a1 1 0 0 0-.48.854V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a1 1 0 0 0-.48-.853L18 11M6 4.933V21" }], ["circle", { cx: "12", cy: "9", r: "2" }]],
      library: [["rect", { width: "8", height: "18", x: "3", y: "3", rx: "1" }], ["path", { d: "M7 3v18m13.4-2.1c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" }]],
      soup: [["path", { d: "M11.248 3c.273.1.808.53.747 1.36-.05.83-.938 1.2-.989 2.02-.06.78.333 1.24.727 1.62m4.519-5c.268.1.794.53.745 1.36-.06.83-.923 1.2-.993 2.02-.05.78.338 1.24.725 1.62m2.771 4L22 6M4 12a1 1 0 0 0-.99 1.133A9 9 0 0 0 12 21a9 9 0 0 0 8.99-7.867A1 1 0 0 0 20 12zm2.252-9c.268.1.794.53.745 1.36-.06.83-.923 1.2-.993 2.02-.05.78.338 1.24.735 1.62M7 21h10" }]],
      store: [["path", { d: "M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5m8.774-10.69a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" }], ["path", { d: "M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" }]],
      trees: [["path", { d: "M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0m-3 6v6m6-3v3" }], ["path", { d: "M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5" }]],
      coffee: [["path", { d: "M10 2v2m4-2v2m2 4a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2" }]],
      shoppingBag: [["path", { d: "M16 10a4 4 0 0 1-8 0M3.103 6.034h17.794" }], ["path", { d: "M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" }]],
      mapPin: [["path", { d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" }], ["circle", { cx: "12", cy: "10", r: "3" }]],
      house: [["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }], ["path", { d: "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }]],
      hospital: [["path", { d: "M12 7v4m2 10v-3a2 2 0 0 0-4 0v3m4-12h-4" }], ["path", { d: "M18 11h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2" }], ["path", { d: "M18 21V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16" }]],
      train: [["path", { d: "M8 3.1V7a4 4 0 0 0 8 0V3.1M9 15l-1-1m7 1 1-1" }], ["path", { d: "M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Zm-1 0-2 3m10-3 2 3" }]],
      bus: [["path", { d: "M4 6 2 7m8-1h4m8 1-2-1" }], ["rect", { width: "16", height: "16", x: "4", y: "3", rx: "2" }], ["path", { d: "M4 11h16M8 15h.01M16 15h.01M6 19v2m12 0v-2" }]],
      dumbbell: [["path", { d: "M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829zM2.5 21.5l1.4-1.4M20.1 3.9l1.4-1.4M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829zM9.6 14.4l4.8-4.8" }]],
      gamepad: [["path", { d: "M6 11h4M8 9v4m7-1h.01M18 10h.01m-.69-5H6.68a4 4 0 0 0-3.978 3.59l-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258q-.01-.075-.017-.151A4 4 0 0 0 17.32 5" }]],
      briefcase: [["path", { d: "M12 12h.01M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2m14 7a18.15 18.15 0 0 1-20 0" }], ["rect", { width: "20", height: "14", x: "2", y: "6", rx: "2" }]],
      music: [["circle", { cx: "8", cy: "18", r: "4" }], ["path", { d: "M12 18V2l7 4" }]],
      pawPrint: [["circle", { cx: "11", cy: "4", r: "2" }], ["circle", { cx: "18", cy: "8", r: "2" }], ["circle", { cx: "20", cy: "16", r: "2" }], ["path", { d: "M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045q-.64-2.065-2.7-2.705A3.5 3.5 0 0 1 5.5 10Z" }]],
      mcdonalds: [["path", { d: "M17.243 3.006c2.066 0 3.742 8.714 3.742 19.478H24c0-11.588-3.042-20.968-6.766-20.968-2.127 0-4.007 2.81-5.248 7.227-1.241-4.416-3.121-7.227-5.231-7.227C3.031 1.516 0 10.888 0 22.476h3.014c0-10.763 1.658-19.47 3.724-19.47s3.741 8.05 3.741 17.98h2.997c0-9.93 1.684-17.98 3.75-17.98Z" }]]
    };
    function IconifyGlyph({ name, size = 24, ...props }) {
      const nodes = iconifyGlyphs[name] || iconifyGlyphs.sparkles;
      const brand = name === "mcdonalds";
      return h("svg", {
        viewBox: "0 0 24 24",
        width: size,
        height: size,
        fill: brand ? "currentColor" : "none",
        stroke: brand ? "none" : "currentColor",
        strokeWidth: brand ? void 0 : "2",
        strokeLinecap: brand ? void 0 : "round",
        strokeLinejoin: brand ? void 0 : "round",
        "aria-hidden": "true",
        "data-iconify-icon": name,
        ...props
      }, nodes.map(([tag, attrs], i) => h(tag, { key: i, ...attrs })));
    }
    const behaviorMeta = {
      idle: ["sparkles", "\u53D1\u5446"],
      sleep: ["moon", "\u7761\u89C9"],
      walk: ["footprints", "\u79FB\u52A8\u4E2D"],
      study: ["pencil", "\u5B66\u4E60 / \u521B\u4F5C"],
      eat: ["utensils", "\u5403\u4E1C\u897F"],
      phone: ["smartphone", "\u73A9\u624B\u673A"],
      photo: ["camera", "\u62CD\u7167"],
      bath: ["bath", "\u6D17\u6F31"]
    };
    const placeIconOptions = [
      "mapPin",
      "house",
      "bed",
      "school",
      "library",
      "soup",
      "store",
      "trees",
      "coffee",
      "shoppingBag",
      "mcdonalds",
      "hospital",
      "train",
      "bus",
      "dumbbell",
      "gamepad",
      "briefcase",
      "music",
      "pawPrint"
    ];
    function FeiyuMark({ size = 20, map = false }) {
      return h("img", {
        "data-fl-brand-mark": "",
        "data-fl-map-logo": map ? "" : void 0,
        src: `${API}/logo?v=${UI_ASSET_VERSION}`,
        width: size,
        height: size,
        alt: "",
        "aria-hidden": "true",
        draggable: false
      });
    }
    function PlaceGlyph({ id, icon }) {
      const icons = {
        dorm: "bed",
        classroom: "school",
        library: "library",
        canteen: "soup",
        shop: "store",
        outdoor: "trees",
        cafe: "coffee",
        mall: "shoppingBag",
        mcdonalds: "mcdonalds"
      };
      const name = iconifyGlyphs[icon] ? icon : icons[id] || "mapPin";
      return h(IconifyGlyph, {
        name,
        size: 34,
        "data-fl-place-glyph": "",
        style: id === "mcdonalds" ? { color: "#ffbc0d" } : void 0
      });
    }
    function WorldMap({ world, map }) {
      const nodes = map && map.\u5730\u70B9 || [];
      const edges = map && map.\u8DEF\u5F84 || [];
      const mapStyle = map && map.\u5E95\u56FE === "none" ? "none" : "xueyuan-road";
      const point = world && world.position || { x: 50, y: 50 };
      const behavior = world && world.behavior || "idle";
      const spriteBehavior = behaviorMeta[behavior] ? behavior : "idle";
      const meta = behaviorMeta[behavior] || behaviorMeta.idle;
      const active = world && world.moving && world.destination ? world.destination.id : world && world.location && world.location.id;
      const routePairs = new Set((world && world.route || []).slice(1).map((id, i) => {
        const from = world.route[i];
        return [from, id].sort().join(":");
      }));
      return h(
        "div",
        { "data-fl-map": "", "data-map-style": mapStyle },
        mapStyle === "xueyuan-road" ? h(
          "div",
          { "data-fl-map-layers": "", "aria-hidden": "true" },
          h("img", { "data-fl-map-layer": "base", src: `${API}/map/xueyuan?layer=base&v=${UI_ASSET_VERSION}`, alt: "" }),
          h("img", { "data-fl-map-layer": "anime", src: `${API}/map/xueyuan?layer=anime&v=${UI_ASSET_VERSION}`, alt: "" }),
          h("img", { "data-fl-map-layer": "buildings", src: `${API}/map/xueyuan?layer=buildings&v=${UI_ASSET_VERSION}`, alt: "" })
        ) : null,
        h(
          "div",
          { "data-fl-map-scenery": "", "aria-hidden": "true" },
          h("i", { "data-fl-scenery": "hill-a" }),
          h("i", { "data-fl-scenery": "hill-b" }),
          h("i", { "data-fl-scenery": "pond" }),
          h("i", { "data-fl-scenery": "plaza" })
        ),
        h("div", { "data-fl-map-badge": "" }, h(FeiyuMark, { size: 22, map: true }), mapStyle === "xueyuan-road" ? "\u77FF\u5927 \xB7 \u5B66\u9662\u8DEF\u751F\u6D3B\u5730\u56FE" : "\u9CB8\u5C3E\u6821\u56ED \xB7 \u4ECA\u65E5\u5730\u56FE"),
        h(
          "svg",
          { "data-fl-map-lines": "", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true" },
          edges.map((edge, i) => {
            const a = nodes.find((x) => x.id === edge.from);
            const b = nodes.find((x) => x.id === edge.to);
            const pair = [edge.from, edge.to].sort().join(":");
            const points = a && b ? [a, ...Array.isArray(edge.via) ? edge.via : [], b] : [];
            const d = points.length ? `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}` : "";
            return a && b ? h("g", {
              key: i,
              "data-fl-road": "",
              "data-fl-road-active": routePairs.has(pair) ? "" : void 0
            }, h("path", { "data-fl-road-base": "", d }), h("path", { "data-fl-road-mark": "", d })) : null;
          })
        ),
        nodes.map((node) => h(
          "div",
          {
            key: node.id,
            "data-fl-place": "",
            "data-place": node.id,
            "data-fl-active": active === node.id ? "" : void 0,
            style: { left: node.x + "%", top: node.y + "%" },
            title: (node.\u5173\u952E\u8BCD || []).join("\u3001")
          },
          h("span", { "data-fl-place-marker": "" }, h(PlaceGlyph, { id: node.id, icon: node.icon })),
          h("span", { "data-fl-place-name": "" }, node.name)
        )),
        world && world.enabled !== false ? h("div", {
          "data-fl-avatar": "",
          style: { left: point.x + "%", top: point.y + "%" }
        }, h(
          "div",
          { "data-fl-avatar-motion": "", "data-behavior": behavior },
          h("div", {
            "data-fl-avatar-sprite": "",
            "aria-hidden": "true",
            style: { "--fl-avatar-image": `url(${API}/avatar/${spriteBehavior}?v=${UI_ASSET_VERSION})` }
          }),
          h("span", { "data-fl-avatar-bubble": "", title: meta[1] }, h(IconifyGlyph, { name: meta[0], size: 17 })),
          h("span", { "data-fl-avatar-label": "" }, world.moving && world.destination ? `\u53BB${world.destination.name} ${Math.round((world.progress || 0) * 100)}%` : world.location && world.location.name || "\u672A\u77E5\u4F4D\u7F6E")
        )) : null,
        mapStyle === "xueyuan-road" ? h("a", {
          "data-fl-map-attribution": "",
          href: "https://www.openstreetmap.org/copyright",
          target: "_blank",
          rel: "noreferrer"
        }, "\xA9 OpenStreetMap contributors \xB7 modified") : null
      );
    }
    function Panel() {
      const [config, setConfig] = useState(null);
      const [savedConfig, setSavedConfig] = useState(null);
      const [error, setError] = useState("");
      const [message, setMessage] = useState("");
      const [issues, setIssues] = useState([]);
      const [tab, setTab] = useState("now");
      const [group, setGroup] = useState("now");
      const [tableName, setTableName] = useState("\u65E5\u5E38");
      const [weekday, setWeekday] = useState("1");
      const [preview, setPreview] = useState(null);
      const [configPath, setConfigPath] = useState("");
      const [previewAt, setPreviewAt] = useState("");
      const [selectedPreview, setSelectedPreview] = useState(null);
      const previewRequest = React.useRef(0);
      const [busy, setBusy] = useState(false);
      const [timeline, setTimeline] = useState([]);
      const [currentMinute, setCurrentMinute] = useState(0);
      const [current, setCurrent] = useState(null);
      const [meta, setMeta] = useState(null);
      const [adjustments, setAdjustments] = useState([]);
      const [world, setWorld] = useState(null);
      const [replay, setReplay] = useState(null);
      const [replayMinute, setReplayMinute] = useState(0);
      const [replayDate, setReplayDate] = useState("");
      const [replayPlaying, setReplayPlaying] = useState(false);
      const [replaySpeed, setReplaySpeed] = useState(10);
      const replayEnd = replay && replay.date === replay.today ? replay.currentMinute : 1439;
      const replayRequest = React.useRef(0);
      const [backupCandidate, setBackupCandidate] = useState(null);
      const [inferenceText, setInferenceText] = useState("\u8E72\u7740\u770B\u732B\u5403\u5B8C\u534A\u6839\u706B\u817F\u80A0");
      const [inference, setInference] = useState(null);
      const [continuity, setContinuity] = useState(null);
      const [affect, setAffect] = useState(null);
      const [mind, setMind] = useState(null);
      const [memoryDraft, setMemoryDraft] = useState("");
      const [preferenceDraft, setPreferenceDraft] = useState({ owner: "self", key: "", value: "" });
      const [goalDraft, setGoalDraft] = useState({ title: "", reason: "", nextStep: "", scope: "virtual" });
      const [continuityDraft, setContinuityDraft] = useState({ kind: "tasks", title: "", detail: "", origin: "", dueLocal: "", with: "", personId: "", nextStep: "", placeId: "", artifactType: "none" });
      const [personDraft, setPersonDraft] = useState({ name: "", relation: "", notes: "", origin: "", closeness: 50 });
      const dirty = Boolean(config && savedConfig && JSON.stringify(config) !== JSON.stringify(savedConfig));
      const load = async (preserveConfig = false, silent = false) => {
        try {
          const data = await getJson(API + "/state");
          if (!preserveConfig) {
            setConfig(data.config);
            setSavedConfig(clone2(data.config));
            setIssues([]);
          }
          setPreview(data.preview);
          setConfigPath(data.configPath || "");
          setTimeline(data.timeline || []);
          setCurrentMinute(data.currentMinute || 0);
          setCurrent(data.current || null);
          setMeta(data.meta || null);
          setAdjustments(data.adjustments || []);
          setWorld(data.world || null);
          setError("");
        } catch (e) {
          if (!silent) setError("\u8BFB\u4E0D\u5230\u914D\u7F6E\uFF1A" + e.message);
        }
      };
      useEffect(() => {
        load();
      }, []);
      useEffect(() => {
        const refresh = () => {
          if (document.hidden) return;
          load(true, true);
        };
        const timer = window.setInterval(refresh, 3e4);
        document.addEventListener("visibilitychange", refresh);
        return () => {
          window.clearInterval(timer);
          document.removeEventListener("visibilitychange", refresh);
        };
      }, []);
      useEffect(() => {
        const warn = (e) => {
          if (dirty) {
            e.preventDefault();
            e.returnValue = "";
          }
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
      }, [dirty]);
      useEffect(() => {
        if (!replayPlaying || tab !== "replay") return void 0;
        const timer = window.setInterval(() => {
          setReplayMinute((minute) => Math.min(replayEnd, minute + replaySpeed));
        }, 650);
        return () => window.clearInterval(timer);
      }, [replayPlaying, replaySpeed, tab, replayEnd]);
      useEffect(() => {
        if (replayMinute >= replayEnd && replayPlaying) setReplayPlaying(false);
      }, [replayMinute, replayPlaying, replayEnd]);
      const patch = (path, value) => setConfig((prev) => prev ? setPath(prev, path, value) : prev);
      const save = async () => {
        if (!config) return;
        setBusy(true);
        setMessage("\u4FDD\u5B58\u4E2D\u2026");
        try {
          const data = await postJson(API + "/save", { config });
          setConfig(data.config);
          setPreview(data.preview);
          setTimeline(data.timeline || []);
          setCurrentMinute(data.currentMinute || 0);
          setSavedConfig(clone2(data.config));
          setCurrent(data.current || null);
          setMeta(data.meta || null);
          setAdjustments(data.adjustments || []);
          setWorld(data.world || null);
          setIssues(data.issues || []);
          setMessage((data.issues || []).length ? `\u5DF2\u4FDD\u5B58\uFF0C\u6709 ${(data.issues || []).length} \u9879\u914D\u7F6E\u63D0\u793A` : "\u5DF2\u4FDD\u5B58\uFF0C\u4E0B\u4E00\u8F6E\u5C31\u7528\u65B0\u914D\u7F6E");
        } catch (e) {
          setMessage("\u4FDD\u5B58\u5931\u8D25\uFF1A" + e.message);
        }
        setBusy(false);
      };
      const reload = async () => {
        if (dirty && !window.confirm("\u8FD8\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF0C\u786E\u5B9A\u91CD\u65B0\u8BFB\u53D6\u5E76\u653E\u5F03\u5B83\u4EEC\u5417\uFF1F")) return;
        await load();
        setMessage("\u5DF2\u91CD\u65B0\u8BFB\u53D6");
      };
      const regenerate = async () => {
        if (dirty) {
          setMessage("\u8BF7\u5148\u4FDD\u5B58\u4FEE\u6539\uFF0C\u518D\u91CD\u65B0\u751F\u6210\u4ECA\u65E5\u5267\u672C");
          return;
        }
        if (!window.confirm("\u91CD\u65B0\u751F\u6210\u4F1A\u66FF\u6362\u4ECA\u5929\u5DF2\u7ECF\u56FA\u5B9A\u4E0B\u6765\u7684\u5267\u672C\uFF0C\u7EE7\u7EED\u5417\uFF1F")) return;
        setBusy(true);
        setMessage("\u6B63\u5728\u91CD\u65B0\u751F\u6210\u4ECA\u65E5\u5267\u672C\u2026");
        try {
          const data = await postJson(API + "/regenerate", {});
          setPreview(data.preview);
          setTimeline(data.timeline || []);
          setCurrentMinute(data.currentMinute || 0);
          setCurrent(data.current || null);
          setMeta(data.meta || null);
          setAdjustments(data.adjustments || []);
          setWorld(data.world || null);
          setMessage("\u4ECA\u65E5\u5267\u672C\u5DF2\u91CD\u65B0\u751F\u6210");
        } catch (e) {
          setMessage("\u91CD\u65B0\u751F\u6210\u5931\u8D25\uFF1A" + e.message);
        }
        setBusy(false);
      };
      const undoRegenerate = async () => {
        setBusy(true);
        setMessage("\u6B63\u5728\u6062\u590D\u4E0A\u4E00\u6B21\u5267\u672C\u2026");
        try {
          const data = await postJson(API + "/undo-regenerate", {});
          setPreview(data.preview);
          setTimeline(data.timeline || []);
          setCurrentMinute(data.currentMinute || 0);
          setCurrent(data.current || null);
          setMeta(data.meta || null);
          setAdjustments(data.adjustments || []);
          setWorld(data.world || null);
          setMessage("\u5DF2\u64A4\u9500\u4E0A\u4E00\u6B21\u91CD\u65B0\u751F\u6210");
        } catch (e) {
          setMessage("\u64A4\u9500\u5931\u8D25\uFF1A" + e.message);
        }
        setBusy(false);
      };
      const deleteAdjustment = async (item) => {
        if (!window.confirm(`\u64A4\u9500 ${clockOf(item.start)}\u2013${clockOf(item.end)} \u7684\u300C${item.what}\u300D\u5417\uFF1F`)) return;
        setBusy(true);
        setMessage("\u6B63\u5728\u64A4\u9500\u4E34\u65F6\u8C03\u6574\u2026");
        try {
          const data = await postJson(API + "/adjustments/delete", { date: item.date, id: item.id, index: item.index });
          setPreview(data.preview);
          setTimeline(data.timeline || []);
          setCurrentMinute(data.currentMinute || 0);
          setCurrent(data.current || null);
          setMeta(data.meta || null);
          setAdjustments(data.adjustments || []);
          setWorld(data.world || null);
          setMessage("\u8FD9\u6761\u4E34\u65F6\u8C03\u6574\u5DF2\u64A4\u9500");
        } catch (e) {
          setMessage("\u64A4\u9500\u8C03\u6574\u5931\u8D25\uFF1A" + e.message);
        }
        setBusy(false);
      };
      const previewOther = async () => {
        const request = ++previewRequest.current;
        try {
          const [date, time = "00:00"] = previewAt.split("T");
          const [hour, minute] = time.split(":").map(Number);
          const localMinute = hour * 60 + minute;
          const query = date ? `date=${encodeURIComponent(date)}&minute=${localMinute}` : `ts=${Date.now()}`;
          const data = await getJson(API + "/preview?" + query);
          if (previewRequest.current === request) setSelectedPreview({ ...data, label: previewAt.replace("T", " ") });
        } catch (e) {
          if (previewRequest.current === request) setMessage("\u9884\u89C8\u5931\u8D25\uFF1A" + e.message);
        }
      };
      const loadReplay = async (date = replayDate, jumpToNow = false) => {
        const request = ++replayRequest.current;
        setReplayPlaying(false);
        setMessage("\u6B63\u5728\u8BFB\u53D6\u751F\u6D3B\u56DE\u653E\u2026");
        try {
          const query = date ? `date=${encodeURIComponent(date)}&minute=720` : `ts=${Date.now()}`;
          const data = await getJson(API + "/replay?" + query);
          if (request !== replayRequest.current) return;
          setReplay(data);
          setReplayDate(data.date || date || "");
          setReplayMinute(jumpToNow ? data.currentMinute || 0 : 0);
          setMessage(`\u5DF2\u52A0\u8F7D ${data.date || date} \u7684\u751F\u6D3B\u56DE\u653E`);
        } catch (e) {
          if (request === replayRequest.current) setMessage("\u56DE\u653E\u8BFB\u53D6\u5931\u8D25\uFF1A" + e.message);
        }
      };
      useEffect(() => {
        if (tab === "replay" && !replay) loadReplay("", true);
        if (tab === "continuity" && !continuity) loadContinuity();
        if (tab === "inner" && !affect) loadAffect();
        if (tab === "persona" && !mind) loadMind();
      }, [tab]);
      const loadAffect = async () => {
        try {
          setAffect(await getJson(API + "/affect"));
        } catch (e) {
          setMessage("\u5185\u5728\u72B6\u6001\u8BFB\u53D6\u5931\u8D25\uFF1A" + e.message);
        }
      };
      const resetInner = async () => {
        if (!window.confirm("\u91CD\u7F6E\u5FC3\u60C5\u5230\u57FA\u7EBF\uFF1F\u4E8B\u4EF6\u5BA1\u8BA1\u8BB0\u5F55\u4F1A\u4FDD\u7559\u3002")) return;
        setBusy(true);
        try {
          setAffect(await postJson(API + "/affect/reset", {}));
          setMessage("\u5185\u5728\u72B6\u6001\u5DF2\u56DE\u5230\u57FA\u7EBF");
        } catch (e) {
          setMessage("\u91CD\u7F6E\u5931\u8D25\uFF1A" + e.message);
        }
        setBusy(false);
      };
      const loadMind = async () => {
        try {
          setMind(await getJson(API + "/mind"));
        } catch (e) {
          setMessage("\u4EBA\u683C\u8BFB\u53D6\u5931\u8D25\uFF1A" + e.message);
        }
      };
      const mindAction = async (path, body) => {
        setBusy(true);
        try {
          setMind(await postJson(API + path, body));
          setMessage("\u4EBA\u683C\u72B6\u6001\u5DF2\u66F4\u65B0");
          setBusy(false);
          return true;
        } catch (e) {
          setMessage("\u4EBA\u683C\u66F4\u65B0\u5931\u8D25\uFF1A" + e.message);
          setBusy(false);
          return false;
        }
      };
      const triggerInitiative = async () => {
        setBusy(true);
        setMessage("\u6B63\u5728\u68C0\u67E5\u6B64\u523B\u662F\u5426\u9002\u5408\u4E3B\u52A8\u5F00\u53E3\u2026");
        try {
          const data = await postJson(API + "/mind/initiative", {});
          setMind(data);
          setMessage(data.initiativeResult?.sent ? "\u5DF2\u7ECF\u5728\u6839\u4F1A\u8BDD\u4E3B\u52A8\u5F00\u53E3" : `\u8FD9\u6B21\u4FDD\u6301\u5B89\u9759\uFF1A${data.initiativeResult?.reason || "\u6CA1\u6709\u5408\u9002\u8BDD\u9898"}`);
        } catch (e) {
          setMessage("\u4E3B\u52A8\u610F\u56FE\u6267\u884C\u5931\u8D25\uFF1A" + e.message);
        }
        setBusy(false);
      };
      const loadContinuity = async () => {
        try {
          setContinuity(await getJson(API + "/continuity"));
        } catch (e) {
          setMessage("\u8FDE\u7EED\u6027\u8BFB\u53D6\u5931\u8D25\uFF1A" + e.message);
        }
      };
      const continuityAction = async (body) => {
        setBusy(true);
        try {
          const data = await postJson(API + "/continuity/entity", body);
          setContinuity(data);
          setMessage("\u8FDE\u7EED\u6027\u5DF2\u66F4\u65B0");
          setBusy(false);
          return true;
        } catch (e) {
          setMessage("\u66F4\u65B0\u5931\u8D25\uFF1A" + e.message);
          setBusy(false);
          return false;
        }
      };
      const createContinuity = async () => {
        if (!continuityDraft.title.trim()) {
          setMessage("\u5148\u586B\u5199\u540D\u79F0");
          return;
        }
        if (continuityDraft.kind === "threads" && !continuityDraft.origin.trim()) {
          setMessage("\u957F\u671F\u4E3B\u7EBF\u5FC5\u987B\u586B\u5199\u6765\u6E90");
          return;
        }
        const ok = await continuityAction({
          ...continuityDraft,
          action: "create",
          dueAt: continuityDraft.dueLocal ? new Date(continuityDraft.dueLocal).getTime() : 0,
          artifact: { type: continuityDraft.artifactType, name: continuityDraft.title }
        });
        if (ok) setContinuityDraft((x) => ({ ...x, title: "", detail: "", origin: "", dueLocal: "", with: "", personId: "", nextStep: "", placeId: "" }));
      };
      const personAction = async (body) => {
        setBusy(true);
        try {
          const data = await postJson(API + "/continuity/person", body);
          setContinuity(data);
          setMessage("\u4EBA\u7269\u5173\u7CFB\u5DF2\u66F4\u65B0");
          setBusy(false);
          return true;
        } catch (e) {
          setMessage("\u4EBA\u7269\u66F4\u65B0\u5931\u8D25\uFF1A" + e.message);
          setBusy(false);
          return false;
        }
      };
      const createPerson = async () => {
        if (!personDraft.name.trim() || !personDraft.origin.trim()) {
          setMessage("\u4EBA\u7269\u59D3\u540D\u548C\u6765\u6E90\u90FD\u9700\u8981\u586B\u5199");
          return;
        }
        const closeness = Number(personDraft.closeness);
        const ok = await personAction({ ...personDraft, action: "create", closeness: Number.isFinite(closeness) ? closeness : 50 });
        if (ok) setPersonDraft({ name: "", relation: "", notes: "", origin: "", closeness: 50 });
      };
      const settleContinuity = async () => {
        setBusy(true);
        try {
          const data = await postJson(API + "/continuity/settle", {});
          setContinuity(data);
          setMessage(`\u7ED3\u7B97\u5B8C\u6210\uFF1A\u65B0\u589E ${data.applied || 0} \u9879\u53D8\u5316`);
        } catch (e) {
          setMessage("\u7ED3\u7B97\u5931\u8D25\uFF1A" + e.message);
        }
        setBusy(false);
      };
      const syncTomorrow = async () => {
        setBusy(true);
        setMessage("\u6B63\u5728\u628A\u8FDE\u7EED\u6027\u540C\u6B65\u5230\u660E\u65E5\u5267\u672C\u2026");
        try {
          const data = await postJson(API + "/continuity/sync-tomorrow", {});
          setContinuity(data);
          setMessage(data.changed ? "\u660E\u65E5\u5267\u672C\u5DF2\u91CD\u65B0\u751F\u6210\uFF0C\u5E76\u5173\u8054\u5F53\u524D\u4E8B\u9879" : "\u660E\u65E5\u5267\u672C\u5DF2\u7ECF\u662F\u6700\u65B0\u7684");
        } catch (e) {
          setMessage("\u540C\u6B65\u5931\u8D25\uFF0C\u539F\u660E\u65E5\u5267\u672C\u5DF2\u4FDD\u7559\uFF1A" + e.message);
        }
        setBusy(false);
      };
      const undoTomorrowSync = async () => {
        setBusy(true);
        setMessage("\u6B63\u5728\u6062\u590D\u4E0A\u4E00\u4E2A\u660E\u65E5\u5267\u672C\u2026");
        try {
          const data = await postJson(API + "/continuity/undo-tomorrow", {});
          setContinuity(data);
          setMessage("\u5DF2\u6062\u590D\u4E0A\u4E00\u4E2A\u660E\u65E5\u5267\u672C");
        } catch (e) {
          setMessage("\u6062\u590D\u5931\u8D25\uFF1A" + e.message);
        }
        setBusy(false);
      };
      const testInference = async () => {
        const text = inferenceText.trim();
        if (!text) {
          setInference(null);
          return;
        }
        try {
          const data = await getJson(API + "/infer?text=" + encodeURIComponent(text));
          setInference(data);
        } catch (e) {
          setMessage("\u8BC6\u522B\u6D4B\u8BD5\u5931\u8D25\uFF1A" + e.message);
        }
      };
      const exportSettings = async () => {
        if (dirty && !window.confirm("\u8FD8\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u5BFC\u51FA\u7684\u662F\u5DF2\u4FDD\u5B58\u914D\u7F6E\uFF0C\u4ECD\u8981\u7EE7\u7EED\u5417\uFF1F")) return;
        setBusy(true);
        setMessage("\u6B63\u5728\u5BFC\u51FA\u8BBE\u7F6E\u5907\u4EFD\u2026");
        try {
          const res = await fetch(API + "/settings-backup", { headers: { accept: "application/json" } });
          if (!res.ok) throw new Error("HTTP " + res.status);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `dsh-feiyu-life-settings-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          setMessage("\u8BBE\u7F6E\u5907\u4EFD\u5DF2\u4E0B\u8F7D");
        } catch (e) {
          setMessage("\u5BFC\u51FA\u5931\u8D25\uFF1A" + e.message);
        }
        setBusy(false);
      };
      const chooseBackup = async (file) => {
        setBackupCandidate(null);
        if (!file) return;
        if (file.size > 1024 * 1024) {
          setMessage("\u5907\u4EFD\u6587\u4EF6\u8D85\u8FC7 1 MiB\uFF0C\u5DF2\u62D2\u7EDD\u8BFB\u53D6");
          return;
        }
        try {
          const value = JSON.parse(await file.text());
          if (!isSupportedSettingsBackup(value)) {
            throw new Error("\u6587\u4EF6\u4E0D\u662F\u53D7\u652F\u6301\u7684\u9C7C\u7684\u751F\u6D3B\u8BBE\u7F6E\u5907\u4EFD");
          }
          setBackupCandidate({ name: file.name, value });
          setMessage("\u5907\u4EFD\u5DF2\u8BFB\u53D6\uFF0C\u786E\u8BA4\u4FE1\u606F\u540E\u53EF\u4EE5\u6062\u590D");
        } catch (e) {
          setMessage("\u8BFB\u53D6\u5907\u4EFD\u5931\u8D25\uFF1A" + e.message);
        }
      };
      const restoreSettings = async () => {
        if (!backupCandidate) return;
        const exportedAt = backupCandidate.value.exportedAt ? new Date(backupCandidate.value.exportedAt).toLocaleString() : "\u672A\u77E5\u65F6\u95F4";
        const scope = Number(backupCandidate.value.version) === 2 ? "\u751F\u6D3B\u8BBE\u7F6E\u3001\u76F8\u673A\u8BBE\u7F6E\u53CA\u4EBA\u683C\u6570\u636E\uFF08\u542B\u957F\u671F\u8BB0\u5FC6\u4E0E\u5173\u7CFB\uFF09" : "\u751F\u6D3B\u8BBE\u7F6E\u548C\u76F8\u673A\u8BBE\u7F6E";
        if (!window.confirm(`\u5C06\u7528 ${exportedAt} \u7684\u5907\u4EFD\u8986\u76D6${scope}\u3002\u7EE7\u7EED\u5417\uFF1F`)) return;
        setBusy(true);
        setMessage("\u6B63\u5728\u6821\u9A8C\u5E76\u6062\u590D\u8BBE\u7F6E\u2026");
        try {
          const data = await postJson(API + "/settings-restore", { backup: backupCandidate.value });
          setMessage((data.issues || []).length ? `\u6062\u590D\u6210\u529F\uFF0C\u670D\u52A1\u7AEF\u540C\u65F6\u4FEE\u6B63\u4E86 ${(data.issues || []).length} \u9879\u65E7\u914D\u7F6E` : "\u6062\u590D\u6210\u529F\uFF0C\u6B63\u5728\u91CD\u65B0\u52A0\u8F7D");
          window.setTimeout(() => window.location.reload(), 350);
        } catch (e) {
          setMessage("\u6062\u590D\u5931\u8D25\uFF0C\u539F\u8BBE\u7F6E\u672A\u6539\u53D8\uFF1A" + e.message);
          setBusy(false);
        }
      };
      if (error) return h("div", { "data-fl-wrap": "" }, h("div", { "data-fl-note": "" }, error));
      if (!config) return h("div", { "data-fl-wrap": "" }, h("div", { "data-fl-note": "" }, "\u8BFB\u53D6\u4E2D\u2026"));
      const previewBlock = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-h": "" }, "\u8FD9\u4F1A\u513F\u6CE8\u5165\u7ED9\u5979\u7684"),
        h("div", { "data-fl-prev": "" }, preview && preview.text || "\uFF08\u5F53\u524D\u6CA1\u6709\u6CE8\u5165\uFF09"),
        h("div", { "data-fl-why": "" }, (preview && preview.evidence || []).map((x, i) => h("span", { key: i, "data-fl-chip": "" }, x))),
        h(
          "div",
          { "data-fl-row": "" },
          h("span", { "data-fl-note": "" }, "\u60F3\u770B\u522B\u7684\u65E5\u5B50\uFF1A"),
          h("input", { "data-fl-input": "", type: "datetime-local", value: previewAt, onChange: (e) => setPreviewAt(e.target.value) }),
          h("button", { "data-fl-btn": "", disabled: !previewAt, onClick: previewOther }, "\u9884\u89C8\u8FD9\u4E2A\u65F6\u95F4"),
          h("button", { "data-fl-btn": "", onClick: () => {
            previewRequest.current++;
            setPreviewAt("");
            setSelectedPreview(null);
          } }, "\u5173\u95ED\u9884\u89C8")
        ),
        selectedPreview ? h(
          "section",
          { "aria-label": "\u6307\u5B9A\u65F6\u95F4\u9884\u89C8" },
          h("strong", null, "\u9884\u89C8 \xB7 " + selectedPreview.label),
          h("div", null, [selectedPreview.current?.what, selectedPreview.world?.location?.name].filter(Boolean).join(" \xB7 ")),
          h("div", { "data-fl-prev": "" }, selectedPreview.preview?.text || "\u6B64\u65F6\u6CA1\u6709\u6CE8\u5165\u5185\u5BB9"),
          h(TimelineChart, { timeline: selectedPreview.timeline, currentMinute: selectedPreview.currentMinute, cursorLabel: "\u9884\u89C8" })
        ) : null,
        h("div", { "data-fl-note": "" }, "\u65F6\u5E8F\u56FE\u91CC\u7EA2\u7EBF\u662F\u6B64\u523B\uFF1B\u7070\u8272\u7684\u6BB5\u662F\u6309\u8BA1\u5212\u8D70\uFF0C\u6A59\u8272\u7684\u6BB5\u662F\u4F60\u7528 life_adjust \u6539\u8FC7\u7684\u3002"),
        meta && meta.agency ? h("div", { "data-fl-note": "" }, `\u5FC3\u91CC\u5728\u63A8\u8FDB\uFF1A${meta.agency.title}${meta.agency.nextStep ? `\uFF0C\u4E0B\u4E00\u6B65 ${meta.agency.nextStep}` : ""}\u3002\u8FD9\u662F\u5185\u90E8\u8BAE\u7A0B\uFF0C\u4E0D\u4EE3\u8868\u5DF2\u7ECF\u5B8C\u6210\u3002`) : null
      );
      const nextActivity = timeline.find((row) => row.start > currentMinute);
      const nowPage = h(
        "div",
        { "data-fl-sec": "" },
        world?.enabled ? h(WorldMap, { world, map: savedConfig?.\u5730\u56FE }) : null,
        nextActivity ? h("p", null, "\u4E0B\u4E00\u9879\u5B89\u6392 \xB7 " + clockOf(nextActivity.start) + " " + nextActivity.what) : null,
        h("div", { "data-fl-h": "" }, "\u4ECA\u5929\u7684\u65F6\u5E8F"),
        h(TimelineChart, { timeline, currentMinute }),
        h("div", { "data-fl-h": "" }, "\u4E34\u65F6\u8C03\u6574\u8BB0\u5F55"),
        adjustments.length ? h(
          "table",
          { "data-fl-table": "" },
          h("thead", null, h(
            "tr",
            null,
            h("th", null, "\u65F6\u95F4"),
            h("th", null, "\u8C03\u6574\u4E3A"),
            h("th", null, "\u624B\u673A / \u7A7F\u7740"),
            h("th", null, "")
          )),
          h("tbody", null, adjustments.map((item) => h(
            "tr",
            { key: item.id || item.index },
            h("td", null, `${clockOf(item.start)}\u2013${clockOf(item.end)}`),
            h("td", null, item.what),
            h("td", null, [item.phone, item.outfit].filter(Boolean).join(" / ") || "\u2014"),
            h("td", null, h("button", { "data-fl-del": "", disabled: busy, onClick: () => deleteAdjustment(item) }, "\u64A4\u9500"))
          )))
        ) : h("div", { "data-fl-empty": "" }, "\u4ECA\u5929\u8FD8\u6CA1\u6709\u7528 life_adjust \u6539\u8FC7\u5B89\u6392"),
        previewBlock,
        h(
          "div",
          { "data-fl-sec": "" },
          h("div", { "data-fl-h": "" }, "\u751F\u6D3B\u7EBF"),
          h(
            "div",
            { "data-fl-row": "" },
            h(
              "label",
              { "data-fl-row": "" },
              h("input", { type: "checkbox", checked: config.\u603B\u5F00\u5173 !== false, onChange: (e) => patch(["\u603B\u5F00\u5173"], e.target.checked) }),
              h("span", null, "\u542F\u7528\u751F\u6D3B\u7EBF\uFF08\u5173\u6389\u5C31\u5B8C\u5168\u4E0D\u6CE8\u5165\uFF09")
            )
          )
        )
      );
      const systemSettings = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-h": "" }, "\u8FD0\u884C\u8BBE\u7F6E"),
        h(
          "div",
          { "data-fl-row": "" },
          h("span", { "data-fl-note": "" }, "\u65F6\u533A"),
          h(Field, { value: config.\u65F6\u533A, width: "data-fl-narrow", onChange: (v) => patch(["\u65F6\u533A"], v) })
        ),
        h(
          "div",
          { "data-fl-row": "" },
          h("span", { "data-fl-note": "" }, "\u6A21\u578B\u786C\u8D85\u65F6\uFF08\u79D2\uFF09"),
          h(Field, { value: config.\u6A21\u578B\u8D85\u65F6\u79D2, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u6A21\u578B\u8D85\u65F6\u79D2"], Number(v) || 60) }),
          h("span", { "data-fl-note": "" }, "\u5267\u672C\u4E0E\u8C03\u6574\u4FDD\u7559\uFF08\u5929\uFF09"),
          h(Field, { value: config.\u5386\u53F2\u4FDD\u7559\u5929\u6570, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u5386\u53F2\u4FDD\u7559\u5929\u6570"], Number(v) || 180) })
        ),
        h(
          "label",
          { "data-fl-sec": "" },
          h("span", { "data-fl-note": "" }, "\u53EA\u5728\u8FD9\u4E9B\u5DE5\u4F5C\u533A\u6CE8\u5165\uFF08\u6BCF\u884C\u4E00\u4E2A\u76EE\u5F55\uFF1B\u7559\u7A7A = \u6240\u6709\u9876\u5C42\u4F1A\u8BDD\uFF09"),
          h("textarea", {
            "data-fl-input": "",
            rows: 3,
            value: (config.\u5DE5\u4F5C\u533A || []).join("\n"),
            placeholder: "/home/ubuntu/dsh-agentchat",
            onChange: (e) => patch(["\u5DE5\u4F5C\u533A"], e.target.value.split(/\r?\n/)),
            style: { width: "100%", resize: "vertical", fontFamily: "ui-monospace, monospace" }
          })
        ),
        h("div", { "data-fl-note": "" }, "\u914D\u7F6E\u6587\u4EF6\uFF1A" + (configPath || "\uFF08\u672A\u77E5\uFF09")),
        h("div", { "data-fl-note": "" }, "\u6539\u5B8C\u70B9\u4E0A\u9762\u7684\u300C\u4FDD\u5B58\u300D\u3002")
      );
      const mapCfg = config.\u5730\u56FE || { \u542F\u7528: true, \u81EA\u52A8\u901A\u52E4: true, \u5730\u70B9: [], \u8DEF\u5F84: [] };
      const placeRows = (mapCfg.\u5730\u70B9 || []).map((node, i) => h(
        "tr",
        { key: node.id || i },
        h("td", null, h(Field, { value: node.name, width: "data-fl-narrow", onChange: (v) => patch(["\u5730\u56FE", "\u5730\u70B9", i, "name"], v) })),
        h("td", null, h(Select, { value: node.icon || "mapPin", options: placeIconOptions, onChange: (v) => patch(["\u5730\u56FE", "\u5730\u70B9", i, "icon"], v) })),
        h("td", null, h(Field, { value: node.x, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u5730\u56FE", "\u5730\u70B9", i, "x"], Number(v)) })),
        h("td", null, h(Field, { value: node.y, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u5730\u56FE", "\u5730\u70B9", i, "y"], Number(v)) })),
        h("td", null, h(Field, {
          value: (node.\u5173\u952E\u8BCD || []).join("\u3001"),
          width: "data-fl-wide",
          onChange: (v) => patch(["\u5730\u56FE", "\u5730\u70B9", i, "\u5173\u952E\u8BCD"], v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean))
        }))
      ));
      const routeRows = (mapCfg.\u8DEF\u5F84 || []).map((edge, i) => {
        const from = (mapCfg.\u5730\u70B9 || []).find((x) => x.id === edge.from);
        const to = (mapCfg.\u5730\u70B9 || []).find((x) => x.id === edge.to);
        return h(
          "tr",
          { key: `${edge.from}-${edge.to}-${i}` },
          h("td", null, from && from.name || edge.from),
          h("td", null, to && to.name || edge.to),
          h("td", null, h(Field, { value: edge.minutes, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u5730\u56FE", "\u8DEF\u5F84", i, "minutes"], Number(v)) }))
        );
      });
      const mapPage = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-note": "" }, "\u5730\u56FE\u4E0D\u662F\u53E6\u4E00\u5957\u72B6\u6001\uFF1A\u5B83\u76F4\u63A5\u6D88\u8D39\u4ECA\u5929\u7684\u771F\u5B9E\u65F6\u95F4\u7EBF\u3002\u76F8\u90BB\u6D3B\u52A8\u53D1\u751F\u5728\u4E0D\u540C\u5730\u70B9\u65F6\uFF0C\u4F1A\u5728\u524D\u4E00\u6BB5\u672B\u5C3E\u81EA\u52A8\u7559\u51FA\u901A\u52E4\u65F6\u95F4\u3002"),
        h(WorldMap, { world, map: mapCfg }),
        h(
          "div",
          { "data-fl-world-cards": "" },
          h("div", { "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, "\u5F53\u524D\u4F4D\u7F6E"), h("div", { "data-fl-stat-v": "" }, world && world.location && world.location.name || "\u672A\u77E5")),
          h("div", { "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, "\u884C\u4E3A"), h("div", { "data-fl-stat-v": "" }, (behaviorMeta[world && world.behavior || "idle"] || behaviorMeta.idle)[1])),
          h("div", { "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, "\u79FB\u52A8"), h("div", { "data-fl-stat-v": "" }, world && world.moving && world.destination ? `\u53BB${world.destination.name} \xB7 ${Math.round((world.progress || 0) * 100)}%` : "\u505C\u7559\u4E2D"))
        ),
        h("div", { "data-fl-h": "" }, "\u8BC6\u522B\u6D4B\u8BD5"),
        h("div", { "data-fl-note": "" }, "\u8F93\u5165\u4E00\u6761\u5267\u672C\u77ED\u53E5\uFF0C\u7ACB\u5373\u68C0\u67E5\u5B83\u4F1A\u88AB\u8BC6\u522B\u6210\u4EC0\u4E48\u5730\u70B9\u548C\u884C\u4E3A\u3002"),
        h(
          "div",
          { "data-fl-row": "" },
          h(Field, { value: inferenceText, width: "data-fl-wide", onChange: setInferenceText }),
          h("button", { "data-fl-btn": "", onClick: testInference }, "\u6D4B\u8BD5")
        ),
        inference ? h(
          "div",
          { "data-fl-why": "" },
          h("span", { "data-fl-chip": "" }, `\u5730\u70B9\uFF1A${inference.location && inference.location.name || "\u672A\u77E5"}`),
          h("span", { "data-fl-chip": "" }, `\u884C\u4E3A\uFF1A${inference.behaviorLabel || inference.behavior}`)
        ) : null,
        h("div", { "data-fl-h": "" }, "\u5730\u56FE\u89C4\u5219"),
        h(
          "div",
          { "data-fl-row": "" },
          h(
            "label",
            { "data-fl-row": "" },
            h("input", { type: "checkbox", checked: mapCfg.\u542F\u7528 !== false, onChange: (e) => patch(["\u5730\u56FE", "\u542F\u7528"], e.target.checked) }),
            h("span", null, "\u542F\u7528\u7A7A\u95F4\u72B6\u6001")
          ),
          h(
            "label",
            { "data-fl-row": "" },
            h("input", { type: "checkbox", checked: mapCfg.\u81EA\u52A8\u901A\u52E4 !== false, onChange: (e) => patch(["\u5730\u56FE", "\u81EA\u52A8\u901A\u52E4"], e.target.checked) }),
            h("span", null, "\u8DE8\u5730\u70B9\u65F6\u81EA\u52A8\u63D2\u5165\u901A\u52E4")
          )
        ),
        h("div", { "data-fl-h": "" }, "\u5730\u70B9\u4E0E\u5750\u6807"),
        h("div", { "data-fl-note": "" }, "\u5173\u952E\u8BCD\u7528\u4E8E\u4ECE\u5267\u672C\u77ED\u53E5\u5224\u65AD\u5730\u70B9\uFF1B\u5750\u6807\u662F\u5730\u56FE\u91CC\u7684\u767E\u5206\u6BD4\u4F4D\u7F6E\u3002"),
        h(
          "table",
          { "data-fl-table": "" },
          h("thead", null, h(
            "tr",
            null,
            h("th", null, "\u5730\u70B9"),
            h("th", null, "\u56FE\u6807"),
            h("th", null, "X"),
            h("th", null, "Y"),
            h("th", null, "\u8BC6\u522B\u5173\u952E\u8BCD")
          )),
          h("tbody", null, placeRows)
        ),
        h("div", { "data-fl-h": "" }, "\u8DEF\u5F84\u8017\u65F6"),
        h(
          "table",
          { "data-fl-table": "" },
          h("thead", null, h("tr", null, h("th", null, "\u4ECE"), h("th", null, "\u5230"), h("th", null, "\u5206\u949F"))),
          h("tbody", null, routeRows)
        )
      );
      const replayFrames = replay && replay.frames || [];
      const replayFrame = replayFrameAt(replayFrames, replayMinute);
      const replayWorld = replayFrame && replayFrame.world;
      const replayCurrent = replayFrame && replayFrame.current;
      const replayMap = replay && replay.map || mapCfg;
      const replayPage = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-note": "" }, "\u628A\u4E00\u5929\u538B\u7F29\u6210\u5730\u56FE\u56DE\u653E\uFF1A\u5730\u70B9\u3001\u901A\u52E4\u8DEF\u7EBF\u548C\u884C\u4E3A\u5168\u90E8\u7531\u670D\u52A1\u7AEF\u6309\u771F\u5B9E\u65F6\u95F4\u7EBF\u751F\u6210\uFF0C\u62D6\u52A8\u8FDB\u5EA6\u4E0D\u4F1A\u6539\u53D8\u5B9E\u9645\u751F\u6D3B\u72B6\u6001\u3002"),
        h(
          "div",
          { "data-fl-row": "" },
          h(Field, { value: replayDate, type: "date", width: "data-fl-narrow", onChange: setReplayDate }),
          h("button", { "data-fl-btn": "", disabled: !replayDate, onClick: () => loadReplay(replayDate, replay && replayDate === replay.today) }, "\u52A0\u8F7D\u8FD9\u4E00\u5929"),
          h("button", {
            "data-fl-btn": "",
            disabled: !replayFrames.length,
            onClick: () => setReplayPlaying((playing) => !playing)
          }, replayPlaying ? "\u6682\u505C" : "\u64AD\u653E"),
          h("button", { "data-fl-btn": "", disabled: !replayFrames.length, onClick: () => {
            setReplayPlaying(false);
            setReplayMinute(0);
          } }, "\u4ECE\u96F6\u70B9\u5F00\u59CB"),
          replay && replay.date === replay.today ? h("button", {
            "data-fl-btn": "",
            onClick: () => {
              setReplayPlaying(false);
              setReplayMinute(replay.currentMinute || 0);
            }
          }, "\u8DF3\u5230\u6B64\u523B") : null,
          h("span", { "data-fl-note": "" }, "\u901F\u5EA6"),
          h(
            "select",
            { "data-fl-input": "", value: replaySpeed, onChange: (e) => setReplaySpeed(Number(e.target.value) || 10) },
            h("option", { value: 5 }, "5 \u5206\u949F/\u5E27"),
            h("option", { value: 10 }, "10 \u5206\u949F/\u5E27"),
            h("option", { value: 30 }, "30 \u5206\u949F/\u5E27"),
            h("option", { value: 60 }, "60 \u5206\u949F/\u5E27")
          )
        ),
        replayFrames.length ? h(
          "div",
          { "data-fl-replay-controls": "" },
          h("button", {
            "data-fl-btn": "",
            "aria-label": replayPlaying ? "\u6682\u505C\u56DE\u653E" : "\u64AD\u653E\u56DE\u653E",
            onClick: () => setReplayPlaying((playing) => !playing)
          }, replayPlaying ? "\u2161" : "\u25B6"),
          h("input", {
            type: "range",
            min: 0,
            max: replayEnd,
            step: 1,
            value: replayMinute,
            "aria-label": "\u56DE\u653E\u65F6\u95F4",
            onChange: (e) => {
              setReplayPlaying(false);
              setReplayMinute(Number(e.target.value));
            }
          }),
          h("span", { "data-fl-replay-time": "" }, clockOf(replayMinute))
        ) : h(
          "div",
          { "data-fl-replay-empty": "" },
          { disabled: "\u751F\u6D3B\u7EBF\u5DF2\u5173\u95ED", future: "\u8FD9\u4E00\u5929\u8FD8\u6CA1\u5F00\u59CB\uFF0C\u53EF\u5728\u300C\u6B64\u523B\u300D\u9884\u89C8\u5B89\u6392", missing: "\u8FD9\u4E00\u5929\u6CA1\u6709\u4FDD\u5B58\u5267\u672C" }[replay?.reason] || "\u8FD9\u4E00\u5929\u8FD8\u6CA1\u6709\u53EF\u56DE\u653E\u7684\u751F\u6D3B\u5267\u672C"
        ),
        replayFrames.length ? h(WorldMap, { world: replayWorld, map: replayMap }) : null,
        replayFrames.length ? h(
          "div",
          { "data-fl-world-cards": "" },
          h("div", { "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, "\u56DE\u653E\u65F6\u95F4"), h("div", { "data-fl-stat-v": "" }, `${replay.date || replayDate} ${clockOf(replayMinute)}`)),
          h("div", { "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, "\u6B63\u5728\u505A"), h("div", { "data-fl-stat-v": "", title: replayCurrent && replayCurrent.what }, replayCurrent && replayCurrent.what || "\u7B49\u5F85\u72B6\u6001")),
          h("div", { "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, "\u4F4D\u7F6E / \u884C\u4E3A"), h("div", { "data-fl-stat-v": "" }, [
            replayWorld && replayWorld.moving && replayWorld.destination ? `\u53BB${replayWorld.destination.name}` : replayWorld && replayWorld.location && replayWorld.location.name,
            (behaviorMeta[replayWorld && replayWorld.behavior || "idle"] || behaviorMeta.idle)[1]
          ].filter(Boolean).join(" \xB7 ")))
        ) : null,
        replay && replay.timeline && replay.timeline.length ? h(
          "label",
          { "data-fl-row": "" },
          "\u8DF3\u5230\u6D3B\u52A8",
          h(
            "select",
            {
              "data-fl-input": "",
              value: replay.timeline.find((row) => row.start <= replayMinute && replayMinute < row.end)?.start ?? "",
              onChange: (e) => {
                setReplayPlaying(false);
                setReplayMinute(Number(e.target.value));
              }
            },
            replay.timeline.map((row) => h("option", { key: row.start, value: row.start }, clockOf(row.start) + " " + row.what))
          )
        ) : null,
        replay && replay.timeline && replay.timeline.length ? h(TimelineChart, { timeline: replay.timeline, currentMinute: replayMinute, cursorLabel: "\u56DE\u653E" }) : null
      );
      const calendarTable = (key, label, withRoutine) => h(
        "div",
        { "data-fl-sec": "", key },
        h("div", { "data-fl-h": "" }, label),
        h(Table, {
          columns: withRoutine ? [{ k: "name", t: "\u540D\u5B57" }, { k: "start", t: "\u4ECE" }, { k: "end", t: "\u5230" }, { k: "routine", t: "\u4F5C\u606F" }, { k: "x", t: "" }] : [{ k: "name", t: "\u540D\u5B57" }, { k: "start", t: "\u4ECE" }, { k: "end", t: "\u5230" }, { k: "x", t: "" }],
          rows: (config.\u6821\u5386 || {})[key] || [],
          emptyLabel: "\u6CA1\u6709\u2014\u2014\u8FD9\u6BB5\u65F6\u95F4\u6309\u5E73\u5E38\u8D70",
          add: () => patch(["\u6821\u5386", key], [...(config.\u6821\u5386 || {})[key] || [], withRoutine ? { \u540D: "\u65B0\u7684", \u8D77: "2026-01-01", \u6B62: "2026-01-07", \u4F5C\u606F: "\u5047\u671F" } : { \u540D: "\u65B0\u7684", \u8D77: "2026-01-01", \u6B62: "2026-01-07" }]),
          render: (r, i) => {
            const base = ["\u6821\u5386", key, i];
            const cells = [
              h("td", { key: "a" }, h(Field, { value: r.\u540D, width: "data-fl-narrow", onChange: (v) => patch([...base, "\u540D"], v) })),
              h("td", { key: "b" }, h(Field, { value: r.\u8D77, type: "date", width: "data-fl-narrow", onChange: (v) => patch([...base, "\u8D77"], v) })),
              h("td", { key: "c" }, h(Field, { value: r.\u6B62, type: "date", width: "data-fl-narrow", onChange: (v) => patch([...base, "\u6B62"], v) }))
            ];
            if (withRoutine) cells.push(h("td", { key: "d" }, h(Select, { value: r.\u4F5C\u606F || "\u5047\u671F", options: ["\u65E5\u5E38", "\u665A\u8D77", "\u5047\u671F", "\u5907\u8003"], onChange: (v) => patch([...base, "\u4F5C\u606F"], v) })));
            cells.push(h("td", { key: "x" }, h("button", {
              "data-fl-del": "",
              onClick: () => {
                const next = ((config.\u6821\u5386 || {})[key] || []).filter((_, k) => k !== i);
                patch(["\u6821\u5386", key], next);
              }
            }, "\u5220")));
            return cells;
          }
        })
      );
      const festivalPage = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-h": "" }, "\u6BCF\u5E74\u90FD\u8FC7\u7684\u8282\u65E5"),
        h("div", { "data-fl-note": "" }, "\u53EA\u586B\u6708\u548C\u65E5\uFF0C\u5E74\u5E74\u90FD\u7B97\u3002\u8282\u65E5\u5F53\u5929\u4F1A\u591A\u4E00\u53E5\u300C\u4ECA\u5929\u300D\u7684\u7406\u7531\u3002"),
        h(Table, {
          columns: [{ k: "name", t: "\u540D\u5B57" }, { k: "month", t: "\u6708" }, { k: "day", t: "\u65E5" }, { k: "x", t: "" }],
          rows: (config.\u8282\u65E5 || []).filter((x) => !x.\u8D77),
          emptyLabel: "\u8FD8\u6CA1\u6709",
          add: () => patch(["\u8282\u65E5"], [...config.\u8282\u65E5 || [], { \u540D: "\u65B0\u7684\u8282\u65E5", \u6708: 1, \u65E5: 1 }]),
          render: (r) => {
            const i = (config.\u8282\u65E5 || []).indexOf(r);
            const base = ["\u8282\u65E5", i];
            return [
              h("td", { key: "a" }, h(Field, { value: r.\u540D, width: "data-fl-narrow", onChange: (v) => patch([...base, "\u540D"], v) })),
              h("td", { key: "b" }, h(Field, { value: r.\u6708, type: "number", width: "data-fl-num", onChange: (v) => patch([...base, "\u6708"], Number(v) || 1) })),
              h("td", { key: "c" }, h(Field, { value: r.\u65E5, type: "number", width: "data-fl-num", onChange: (v) => patch([...base, "\u65E5"], Number(v) || 1) })),
              h("td", { key: "x" }, h("button", { "data-fl-del": "", onClick: () => patch(["\u8282\u65E5"], (config.\u8282\u65E5 || []).filter((_, k) => k !== i)) }, "\u5220"))
            ];
          }
        }),
        h("div", { "data-fl-h": "" }, "\u53EA\u653E\u90A3\u51E0\u5929\u7684\uFF08\u6625\u8282\u3001\u56FD\u5E86\u8FD9\u79CD\uFF09"),
        h("div", { "data-fl-note": "" }, "\u586B\u8D77\u6B62\u65E5\u671F\uFF0C\u8FD9\u51E0\u5929\u5F53\u6210\u653E\u5047\uFF0C\u8D70\u5047\u671F\u4F5C\u606F\u3001\u4E0D\u4E0A\u8BFE\u3002"),
        h(Table, {
          columns: [{ k: "name", t: "\u540D\u5B57" }, { k: "start", t: "\u4ECE" }, { k: "end", t: "\u5230" }, { k: "x", t: "" }],
          rows: (config.\u8282\u65E5 || []).filter((x) => x.\u8D77),
          emptyLabel: "\u8FD8\u6CA1\u6709",
          add: () => patch(["\u8282\u65E5"], [...config.\u8282\u65E5 || [], { \u540D: "\u65B0\u7684\u5047\u671F", \u8D77: "2027-01-01", \u6B62: "2027-01-03" }]),
          render: (r) => {
            const i = (config.\u8282\u65E5 || []).indexOf(r);
            const base = ["\u8282\u65E5", i];
            return [
              h("td", { key: "a" }, h(Field, { value: r.\u540D, width: "data-fl-narrow", onChange: (v) => patch([...base, "\u540D"], v) })),
              h("td", { key: "b" }, h(Field, { value: r.\u8D77, type: "date", width: "data-fl-narrow", onChange: (v) => patch([...base, "\u8D77"], v) })),
              h("td", { key: "c" }, h(Field, { value: r.\u6B62, type: "date", width: "data-fl-narrow", onChange: (v) => patch([...base, "\u6B62"], v) })),
              h("td", { key: "x" }, h("button", { "data-fl-del": "", onClick: () => patch(["\u8282\u65E5"], (config.\u8282\u65E5 || []).filter((_, k) => k !== i)) }, "\u5220"))
            ];
          }
        })
      );
      const yearPage = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-note": "" }, '\u8FD9\u662F"\u5E74"\u8FD9\u4E00\u5C42\uFF1A\u5148\u770B\u4ECA\u5929\u843D\u5728\u54EA\u6BB5\u91CC \u2014\u2014 \u7279\u6B8A\uFF08\u8003\u8BD5\u5468\uFF09\u4F18\u5148\uFF0C\u5176\u6B21\u5047\u671F\uFF0C\u5176\u6B21\u662F\u5B66\u671F\u3002\u843D\u5728\u5047\u671F\u5C31\u8D70\u5047\u671F\u4F5C\u606F\u3001\u4E0D\u4E0A\u8BFE\u3002'),
        calendarTable("\u5B66\u671F", "\u5B66\u671F", false),
        calendarTable("\u5047\u671F", "\u5047\u671F", true),
        calendarTable("\u7279\u6B8A", "\u7279\u6B8A\uFF08\u8003\u8BD5\u5468\u3001\u519B\u8BAD\u8FD9\u79CD\uFF09", true),
        festivalPage
      );
      const weekRows = (config.\u8BFE\u8868 || {})[weekday] || [];
      const weekPage = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-note": "" }, "\u53EA\u5199\u5728\u5B66\u671F\u91CC\u6709\u8BFE\u7684\u90A3\u51E0\u5929\u3002\u5047\u671F\u81EA\u52A8\u4E0D\u4E0A\u8BFE\u3002"),
        h("div", { "data-fl-tabs": "" }, [1, 2, 3, 4, 5, 6, 7].map((d) => h("button", {
          key: d,
          "data-fl-tab": "",
          "data-fl-on": String(d) === weekday ? "" : void 0,
          onClick: () => setWeekday(String(d))
        }, weekdayNames[d]))),
        h(Table, {
          columns: [{ k: "a", t: "\u4ECE" }, { k: "b", t: "\u5230" }, { k: "c", t: "\u5728\u5E72\u4EC0\u4E48" }, { k: "d", t: "\u624B\u673A" }, { k: "x", t: "" }],
          rows: weekRows,
          emptyLabel: "\u8FD9\u5929\u6CA1\u8BFE",
          add: () => patch(["\u8BFE\u8868", weekday], [...weekRows, ["08:00", "11:30", "\u4E0A\u8BFE", "\u9759\u97F3"]]),
          render: (r, i) => {
            const base = ["\u8BFE\u8868", weekday, i];
            return [
              h("td", { key: "a" }, h(Field, { value: r[0], type: "time", width: "data-fl-narrow", onChange: (v) => patch([...base, 0], v) })),
              h("td", { key: "b" }, h(Field, { value: r[1], type: "time", width: "data-fl-narrow", onChange: (v) => patch([...base, 1], v) })),
              h("td", { key: "c" }, h(Field, { value: r[2], width: "data-fl-wide", onChange: (v) => patch([...base, 2], v) })),
              h("td", { key: "d" }, h(Select, { value: r[3], options: phoneOptions, onChange: (v) => patch([...base, 3], v) })),
              h("td", { key: "x" }, h("button", { "data-fl-del": "", onClick: () => patch(["\u8BFE\u8868", weekday], weekRows.filter((_, k) => k !== i)) }, "\u5220"))
            ];
          }
        })
      );
      const routineRows = config[tableName] || [];
      const wardrobe = config.\u8863\u67DC || {};
      const parseWardrobe = (value) => [...new Set(String(value || "").split(/[\n、,，]+/).map((x) => x.trim()).filter(Boolean))].slice(0, 12);
      const wardrobeSection = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-h": "" }, "\u89D2\u8272\u8BBE\u5B9A\u4E0E\u8863\u67DC"),
        h("div", { "data-fl-note": "" }, "\u89D2\u8272\u8BBE\u5B9A\u53EA\u7ED9\u6BCF\u65E5\u5267\u672C\u7528\uFF0C\u4E0D\u4F1A\u5199\u8FDB\u4EBA\u683C\uFF0C\u4E5F\u4E0D\u4F1A\u8986\u76D6\u5BF9\u8BDD\u4FA7\u7684\u4EBA\u683C\u8BBE\u5B9A\uFF1B\u7559\u7A7A\u65F6\u5267\u672C\u53EA\u5199\u751F\u6D3B\u4E8B\u5B9E\u3002\u4FDD\u5B58\u540E\uFF0C\u5DF2\u53D1\u751F\u7684\u65F6\u95F4\u7EBF\u4FDD\u6301\u4E0D\u52A8\uFF0C\u5C1A\u672A\u53D1\u751F\u7684\u7247\u6BB5\u6309\u65B0\u8BBE\u7F6E\u589E\u91CF\u8C03\u6574\u3002"),
        h(
          "label",
          { "data-fl-row": "" },
          h("span", { "data-fl-note": "" }, "\u89D2\u8272\u8BBE\u5B9A\uFF08\u6700\u591A 500 \u5B57\uFF09"),
          h("textarea", {
            "data-fl-input": "",
            rows: 3,
            maxLength: 500,
            value: config.\u89D2\u8272\u8BBE\u5B9A || "",
            placeholder: "\u53EF\u9009\uFF1A\u4F8B\u5982\u5979\u662F\u8C01\u3001\u5728\u505A\u4EC0\u4E48\uFF1B\u7559\u7A7A\u5219\u4E0D\u6DFB\u52A0\u4EBA\u683C\u6587\u6848",
            onChange: (e) => patch(["\u89D2\u8272\u8BBE\u5B9A"], e.target.value),
            style: { width: "100%", resize: "vertical", fontFamily: "inherit" }
          })
        ),
        h("div", { "data-fl-h": "" }, "\u8863\u67DC"),
        h("div", { "data-fl-note": "" }, "\u6309\u573A\u666F\u5206\u7EC4\u7684\u8863\u670D\u540D\u79F0\uFF0C\u6BCF\u7C7B\u6700\u591A 12 \u4EF6\u3001\u6BCF\u4EF6\u6700\u591A 12 \u5B57\uFF1B\u7528\u6362\u884C\u6216\u987F\u53F7\u5206\u9694\u3002\u6E05\u7A7A\u67D0\u4E00\u7C7B\u5E76\u4FDD\u5B58\u4F1A\u6062\u590D\u8BE5\u7C7B\u9ED8\u8BA4\u503C\u3002"),
        ...wardrobeLabels.map(([key, label]) => h(
          "label",
          { key, "data-fl-row": "" },
          h("span", { "data-fl-note": "" }, label),
          h("textarea", {
            "data-fl-input": "",
            rows: 2,
            value: (Array.isArray(wardrobe[key]) ? wardrobe[key] : []).join("\n"),
            placeholder: "\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4",
            onChange: (e) => patch(["\u8863\u67DC", key], parseWardrobe(e.target.value)),
            style: { width: "100%", resize: "vertical", fontFamily: "inherit" }
          })
        ))
      );
      const dayPage = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-note": "" }, "\u4E00\u5929\u5207\u6210\u51E0\u6BB5\u3002\u6CE8\u610F\u6709\u4E00\u6BB5\u8981\u542B\u300C\u7761\u7740\u300D\u2014\u2014\u65E9\u4E0A\u51E0\u70B9\u8D77\u662F\u4ECE\u90A3\u6BB5\u7ED3\u5C3E\u7B97\u7684\u3002"),
        h("div", { "data-fl-tabs": "" }, routineTables.map(([k, t]) => h("button", {
          key: k,
          "data-fl-tab": "",
          "data-fl-on": tableName === k ? "" : void 0,
          onClick: () => setTableName(k)
        }, t))),
        h(Table, {
          columns: [{ k: "a", t: "\u4ECE" }, { k: "b", t: "\u5230" }, { k: "c", t: "\u5728\u5E72\u4EC0\u4E48" }, { k: "d", t: "\u624B\u673A" }, { k: "x", t: "" }],
          rows: routineRows,
          emptyLabel: "\u8FD9\u5F20\u8868\u8FD8\u662F\u7A7A\u7684",
          add: () => patch([tableName], [...routineRows, ["20:00", "22:00", "\u5728\u5E72\u70B9\u4EC0\u4E48", "\u5728\u624B"]]),
          render: (r, i) => {
            const base = [tableName, i];
            return [
              h("td", { key: "a" }, h(Field, { value: r[0], type: "time", width: "data-fl-narrow", onChange: (v) => patch([...base, 0], v) })),
              h("td", { key: "b" }, h(Field, { value: r[1], type: "time", width: "data-fl-narrow", onChange: (v) => patch([...base, 1], v) })),
              h("td", { key: "c" }, h(Field, { value: r[2], width: "data-fl-wide", onChange: (v) => patch([...base, 2], v) })),
              h("td", { key: "d" }, h(Select, { value: r[3], options: phoneOptions, onChange: (v) => patch([...base, 3], v) })),
              h("td", { key: "x" }, h("button", { "data-fl-del": "", onClick: () => patch([tableName], routineRows.filter((_, k) => k !== i)) }, "\u5220"))
            ];
          }
        }),
        wardrobeSection,
        h("div", { "data-fl-h": "" }, "\u80FD\u7761\u5230\u4E2D\u5348\u7684\u65E5\u5B50"),
        h("div", { "data-fl-row": "" }, [1, 2, 3, 4, 5, 6, 7].map((d) => h(
          "label",
          { key: d, "data-fl-row": "" },
          h("input", {
            type: "checkbox",
            checked: (config.\u665A\u8D77\u65E5 || []).includes(d),
            onChange: (e) => {
              const now = config.\u665A\u8D77\u65E5 || [];
              patch(["\u665A\u8D77\u65E5"], e.target.checked ? [...now.filter((x) => x !== d), d].sort((a, b) => a - b) : now.filter((x) => x !== d));
            }
          }),
          h("span", null, weekdayNames[d])
        )))
      );
      const period = config.\u7ECF\u671F || {};
      const deviation = config.\u504F\u79BB || {};
      const bodyPage = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-h": "" }, "\u7ECF\u671F"),
        h("div", { "data-fl-note": "" }, "\u8D77\u59CB\u5199\u6700\u8FD1\u4E00\u6B21\u7684\u7B2C\u4E00\u5929\uFF1B\u5230\u4E86\u90A3\u51E0\u5929\uFF0C\u5979\u4F1A\u8170\u9178\u3001\u60F3\u5403\u751C\u7684\u3001\u813E\u6C14\u5DEE\u4E00\u70B9\u3002"),
        h(
          "div",
          { "data-fl-row": "" },
          h("span", { "data-fl-note": "" }, "\u8D77\u59CB"),
          h(Field, { value: period.\u8D77\u59CB, type: "date", width: "data-fl-narrow", onChange: (v) => patch(["\u7ECF\u671F", "\u8D77\u59CB"], v) }),
          h("span", { "data-fl-note": "" }, "\u5468\u671F\uFF08\u5929\uFF09"),
          h(Field, { value: period.\u5468\u671F, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u7ECF\u671F", "\u5468\u671F"], Number(v) || 29) }),
          h("span", { "data-fl-note": "" }, "\u6301\u7EED\uFF08\u5929\uFF09"),
          h(Field, { value: period.\u5929\u6570, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u7ECF\u671F", "\u5929\u6570"], Number(v) || 5) })
        ),
        h("div", { "data-fl-h": "" }, "\u5076\u5C14\u4E0D\u6309\u8868\u8D70"),
        h("div", { "data-fl-note": "" }, "0 \u5230 1 \u4E4B\u95F4\u7684\u6982\u7387\u30020 = \u6C38\u8FDC\u6309\u8868\u8D70\u3002\u8EBA\u5E73\u65E5\u548C\u51FA\u95E8\u65E5\u4E92\u65A5\uFF0C\u7FD8\u8BFE\u53EA\u5F71\u54CD\u4E0B\u5348\u3002"),
        h(
          "div",
          { "data-fl-row": "" },
          h("span", { "data-fl-note": "" }, "\u8EBA\u5E73"),
          h(Field, { value: deviation.\u8EBA\u5E73\u65E5, type: "number", width: "data-fl-num", step: "0.01", onChange: (v) => patch(["\u504F\u79BB", "\u8EBA\u5E73\u65E5"], Number(v) || 0) }),
          h("span", { "data-fl-note": "" }, "\u51FA\u95E8"),
          h(Field, { value: deviation.\u51FA\u95E8\u65E5, type: "number", width: "data-fl-num", step: "0.01", onChange: (v) => patch(["\u504F\u79BB", "\u51FA\u95E8\u65E5"], Number(v) || 0) }),
          h("span", { "data-fl-note": "" }, "\u7FD8\u4E0B\u5348\u7684\u8BFE"),
          h(Field, { value: deviation.\u7FD8\u4E0B\u5348\u8BFE, type: "number", width: "data-fl-num", step: "0.01", onChange: (v) => patch(["\u504F\u79BB", "\u7FD8\u4E0B\u5348\u8BFE"], Number(v) || 0) })
        ),
        h("div", { "data-fl-note": "" }, '\u6CE8\u610F\uFF1A\u8FD9\u4E9B\u90FD\u662F\u6309\u65E5\u671F\u62BD\u7684\u79CD\u5B50\uFF0C\u540C\u4E00\u5929\u91CC\u4E0D\u4F1A\u53D8\u6765\u53D8\u53BB \u2014\u2014 \u53D8\u7684\u662F"\u4ECA\u5929\u662F\u4E0D\u662F\u8FD9\u79CD\u65E5\u5B50"\u3002')
      );
      const backupValue = backupCandidate && backupCandidate.value;
      const dataPage = h(
        "div",
        { "data-fl-sec": "" },
        systemSettings,
        h("div", { "data-fl-note": "" }, "\u5907\u4EFD\u5305\u62EC\u751F\u6D3B\u548C\u76F8\u673A\u8BBE\u7F6E\uFF0C\u4EE5\u53CA\u4EBA\u683C\u6570\u636E\u4E2D\u7684\u957F\u671F\u8BB0\u5FC6\u3001\u5173\u7CFB\u3001\u504F\u597D\u548C\u76EE\u6807\u3002\u8BF7\u59A5\u5584\u4FDD\u7BA1\u5BFC\u51FA\u7684 JSON \u6587\u4EF6\u3002"),
        h(
          "div",
          { "data-fl-backup-card": "" },
          h(
            "div",
            null,
            h("div", { "data-fl-backup-title": "" }, "\u5BFC\u51FA\u5F53\u524D\u8BBE\u7F6E"),
            h("div", { "data-fl-backup-meta": "" }, "\u53EA\u5BFC\u51FA\u670D\u52A1\u7AEF\u5DF2\u7ECF\u4FDD\u5B58\u7684\u914D\u7F6E\uFF1BAPI Key \u7B49\u5BBF\u4E3B\u51ED\u636E\u4E0D\u5728\u63D2\u4EF6\u914D\u7F6E\u4E2D\uFF0C\u4E5F\u4E0D\u4F1A\u8FDB\u5165\u6587\u4EF6\u3002")
          ),
          h("button", { "data-fl-btn": "", "data-fl-main": "", disabled: busy, onClick: exportSettings }, "\u4E0B\u8F7D\u5907\u4EFD")
        ),
        h(
          "div",
          { "data-fl-backup-card": "" },
          h(
            "div",
            null,
            h("div", { "data-fl-backup-title": "" }, "\u4ECE\u5907\u4EFD\u6062\u590D"),
            h("div", { "data-fl-backup-meta": "" }, "\u5148\u5728\u6D4F\u89C8\u5668\u8BFB\u53D6\u5E76\u5C55\u793A\u6458\u8981\uFF0C\u786E\u8BA4\u540E\u670D\u52A1\u7AEF\u4F1A\u518D\u6B21\u6821\u9A8C\uFF1B\u4EFB\u4E00\u6B65\u5931\u8D25\u90FD\u4F1A\u56DE\u6EDA\u539F\u8BBE\u7F6E\u3002")
          ),
          h(
            "label",
            { "data-fl-btn": "", style: { cursor: busy ? "default" : "pointer" } },
            "\u9009\u62E9 JSON",
            h("input", { type: "file", accept: "application/json,.json", disabled: busy, style: { display: "none" }, onChange: (e) => chooseBackup(e.target.files && e.target.files[0]) })
          )
        ),
        backupValue ? h(
          "div",
          { "data-fl-backup-card": "" },
          h(
            "div",
            null,
            h("div", { "data-fl-backup-title": "" }, backupCandidate.name),
            h("div", { "data-fl-backup-meta": "" }, [
              `\u5BFC\u51FA\u65F6\u95F4\uFF1A${backupValue.exportedAt ? new Date(backupValue.exportedAt).toLocaleString() : "\u672A\u77E5"}`,
              `\u751F\u6D3B\u914D\u7F6E v${backupValue.life && backupValue.life.\u914D\u7F6E\u7248\u672C || "?"} \xB7 \u76F8\u673A\u914D\u7F6E v${backupValue.camera && backupValue.camera.\u914D\u7F6E\u7248\u672C || "?"}`,
              `\u5730\u70B9\uFF1A${backupValue.life && backupValue.life.\u5730\u56FE && Array.isArray(backupValue.life.\u5730\u56FE.\u5730\u70B9) ? backupValue.life.\u5730\u56FE.\u5730\u70B9.length : 0} \u4E2A`
            ].join("\uFF5C"))
          ),
          h("button", { "data-fl-btn": "", "data-fl-main": "", disabled: busy, onClick: restoreSettings }, "\u786E\u8BA4\u6062\u590D")
        ) : null
      );
      const contState = continuity && continuity.state;
      const contPeopleById = new Map((contState && contState.people || []).map((x) => [x.id, x]));
      const contViewById = new Map((continuity && continuity.view && continuity.view.entities || []).map((x) => [x.id, x]));
      const contList = (kind, label) => h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-h": "" }, label),
        contState && (contState[kind] || []).length ? h("div", { "data-fl-cont-grid": "" }, (contState[kind] || []).map((item) => h(
          "div",
          { key: item.id, "data-fl-cont-card": "" },
          h("strong", null, item.title),
          h("div", { "data-fl-cont-meta": "" }, `${item.status}${kind === "threads" ? ` \xB7 ${item.progress || 0}%` : ""}\uFF5C\u6765\u6E90\uFF1A${item.origin || item.source}`),
          item.detail ? h("div", { "data-fl-cont-meta": "" }, item.detail) : null,
          contViewById.get(item.id)?.due?.label ? h("span", { "data-fl-due": "", "data-state": contViewById.get(item.id).due.state }, contViewById.get(item.id).due.label) : null,
          item.with || item.personId || item.placeId ? h("div", { "data-fl-cont-meta": "" }, [item.personId && contPeopleById.get(item.personId) ? `\u548C ${contPeopleById.get(item.personId).name}` : item.with ? `\u548C ${item.with}` : "", item.placeId ? `\u5730\u70B9\uFF1A${item.placeId}` : ""].filter(Boolean).join(" \xB7 ")) : null,
          item.nextStep ? h("div", { "data-fl-cont-meta": "" }, "\u4E0B\u4E00\u6B65\uFF1A" + item.nextStep) : null,
          ["active", "open", "paused"].includes(item.status) ? h(
            "div",
            { "data-fl-row": "", style: { marginTop: 7 } },
            h("button", { "data-fl-btn": "", disabled: busy, onClick: () => continuityAction({ kind, action: "complete", id: item.id }) }, "\u6807\u8BB0\u5B8C\u6210"),
            h("button", { "data-fl-del": "", disabled: busy, onClick: () => continuityAction({ kind, action: "cancel", id: item.id }) }, "\u53D6\u6D88")
          ) : null
        ))) : h("div", { "data-fl-empty": "" }, "\u6682\u65E0")
      );
      const peopleList = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-h": "" }, "\u8BA4\u8BC6\u7684\u4EBA"),
        contState && (contState.people || []).length ? h("div", { "data-fl-cont-grid": "" }, (contState.people || []).map((person) => h(
          "div",
          { key: person.id, "data-fl-cont-card": "" },
          h("strong", null, person.name),
          h("div", { "data-fl-cont-meta": "" }, [person.relation || "\u5173\u7CFB\u672A\u6CE8\u660E", `\u4EB2\u8FD1\u611F ${person.closeness}`, `\u5DF2\u4E92\u52A8 ${person.interactionCount || 0} \u6B21`].join(" \xB7 ")),
          person.notes ? h("div", { "data-fl-cont-meta": "" }, person.notes) : null,
          h("div", { "data-fl-cont-meta": "" }, `\u6765\u6E90\uFF1A${person.origin || person.source}${person.lastInteractionAt ? ` \xB7 \u4E0A\u6B21\u4E92\u52A8 ${new Date(person.lastInteractionAt).toLocaleString()}` : ""}`),
          person.status === "active" ? h("button", { "data-fl-del": "", disabled: busy, onClick: () => personAction({ action: "archive", id: person.id }) }, "\u5F52\u6863") : h("button", { "data-fl-btn": "", disabled: busy, onClick: () => personAction({ action: "restore", id: person.id }) }, "\u6062\u590D")
        ))) : h("div", { "data-fl-empty": "" }, "\u8FD8\u6CA1\u6709\u660E\u786E\u8BB0\u4E0B\u7684\u4EBA\u7269")
      );
      const needs = contState && contState.needs || {};
      const continuityPage = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-note": "" }, "\u8BA1\u5212\u53EA\u662F\u610F\u56FE\uFF1B\u53EA\u6709\u6700\u7EC8\u65F6\u95F4\u7EBF\u5DF2\u7ECF\u7ED3\u675F\u3001\u4E14\u6574\u6BB5\u672A\u88AB life_adjust \u8986\u76D6\uFF0C\u5173\u8054\u4E8B\u9879\u624D\u4F1A\u5B8C\u6210\u3002\u6240\u6709\u6765\u6E90\u548C\u53D8\u5316\u539F\u56E0\u90FD\u53EF\u8FFD\u6EAF\u3002"),
        h(
          "div",
          { "data-fl-stats": "" },
          [["\u7CBE\u529B", needs.energy], ["\u538B\u529B", needs.stress], ["\u793E\u4EA4\u9700\u8981", needs.socialNeed], ["\u7761\u7720\u6B20\u8D26", `${needs.sleepDebtMinutes || 0} \u5206\u949F`]].map(([k, v]) => h("div", { key: k, "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, k), h("div", { "data-fl-stat-v": "" }, v ?? "\u2014")))
        ),
        continuity?.view?.needs?.length ? h("div", { "data-fl-note": "" }, "\u5979\u81EA\u5DF1\u7684\u611F\u89C9\uFF1A" + continuity.view.needs.join("\uFF0C") + "\u3002") : null,
        h("div", { "data-fl-h": "" }, "\u65B0\u589E"),
        h(
          "div",
          { "data-fl-row": "" },
          h(
            "select",
            { "data-fl-input": "", value: continuityDraft.kind, onChange: (e) => setContinuityDraft({ ...continuityDraft, kind: e.target.value }) },
            h("option", { value: "tasks" }, "\u77ED\u671F\u5F85\u529E"),
            h("option", { value: "commitments" }, "\u7EA6\u5B9A"),
            h("option", { value: "threads" }, "\u957F\u671F\u4E3B\u7EBF")
          ),
          h("input", { "data-fl-input": "", value: continuityDraft.title, placeholder: continuityDraft.kind === "tasks" ? "\u4F8B\u5982\uFF1A\u53D6\u5FEB\u9012" : continuityDraft.kind === "commitments" ? "\u4F8B\u5982\uFF1A\u548C\u5988\u5988\u89C6\u9891" : "\u4F8B\u5982\uFF1A\u6574\u7406\u89C6\u89C9\u4F5C\u54C1\u96C6", onChange: (e) => setContinuityDraft({ ...continuityDraft, title: e.target.value }) }),
          h("input", { "data-fl-input": "", value: continuityDraft.detail, placeholder: "\u8865\u5145\u8BF4\u660E\uFF08\u53EF\u9009\uFF09", onChange: (e) => setContinuityDraft({ ...continuityDraft, detail: e.target.value }) }),
          h("input", { "data-fl-input": "", type: "datetime-local", value: continuityDraft.dueLocal, title: "\u622A\u6B62\u6216\u7EA6\u5B9A\u65F6\u95F4", onChange: (e) => setContinuityDraft({ ...continuityDraft, dueLocal: e.target.value }) }),
          h(
            "select",
            { "data-fl-input": "", value: continuityDraft.placeId, title: "\u76F8\u5173\u5730\u70B9", onChange: (e) => setContinuityDraft({ ...continuityDraft, placeId: e.target.value }) },
            h("option", { value: "" }, "\u4E0D\u9650\u5B9A\u5730\u70B9"),
            ...(config.\u5730\u56FE?.\u5730\u70B9 || []).map((node) => h("option", { key: node.id, value: node.id }, node.name))
          ),
          continuityDraft.kind === "commitments" ? h("input", { "data-fl-input": "", value: continuityDraft.with, placeholder: "\u548C\u8C01", onChange: (e) => setContinuityDraft({ ...continuityDraft, with: e.target.value }) }) : null,
          continuityDraft.kind === "commitments" && (contState?.people || []).some((x) => x.status === "active") ? h(
            "select",
            { "data-fl-input": "", value: continuityDraft.personId, title: "\u5173\u8054\u5DF2\u7ECF\u8BB0\u4F4F\u7684\u4EBA", onChange: (e) => setContinuityDraft({ ...continuityDraft, personId: e.target.value }) },
            h("option", { value: "" }, "\u4E0D\u5173\u8054\u4EBA\u7269\u6863\u6848"),
            ...contState.people.filter((x) => x.status === "active").map((person) => h("option", { key: person.id, value: person.id }, person.name))
          ) : null,
          continuityDraft.kind === "threads" ? h("input", { "data-fl-input": "", value: continuityDraft.nextStep, placeholder: "\u4E0B\u4E00\u6B65\u505A\u4EC0\u4E48", onChange: (e) => setContinuityDraft({ ...continuityDraft, nextStep: e.target.value }) }) : null,
          continuityDraft.kind === "threads" ? h("input", { "data-fl-input": "", value: continuityDraft.origin, placeholder: "\u6765\u6E90\uFF08\u5FC5\u586B\uFF09", onChange: (e) => setContinuityDraft({ ...continuityDraft, origin: e.target.value }) }) : null,
          continuityDraft.kind === "threads" ? h(
            "select",
            { "data-fl-input": "", value: continuityDraft.artifactType, onChange: (e) => setContinuityDraft({ ...continuityDraft, artifactType: e.target.value }) },
            h("option", { value: "none" }, "\u65E0\u6210\u679C\u6587\u4EF6"),
            h("option", { value: "document" }, "\u672C\u5730\u6587\u6863\u8BB0\u5F55"),
            h("option", { value: "album" }, "\u5DF2\u6709\u7167\u7247\u6E05\u5355")
          ) : null,
          h("button", { "data-fl-btn": "", "data-fl-main": "", disabled: busy, onClick: createContinuity }, "\u6DFB\u52A0")
        ),
        continuityDraft.kind === "threads" ? h("div", { "data-fl-note": "" }, "\u957F\u671F\u4E3B\u7EBF\u7684\u6765\u6E90\u5FC5\u586B\uFF1B\u6210\u679C\u53EA\u5199\u63D2\u4EF6\u76EE\u5F55\u4E2D\u7684\u6267\u884C\u8BB0\u5F55\u6216\u5DF2\u6709\u7167\u7247\u6E05\u5355\uFF0C\u4E0D\u4F1A\u751F\u56FE\u3001\u53D1\u6D88\u606F\u6216\u64CD\u4F5C\u5916\u90E8\u6587\u4EF6\u3002") : null,
        h("div", { "data-fl-h": "" }, "\u65B0\u589E\u8BA4\u8BC6\u7684\u4EBA"),
        h(
          "div",
          { "data-fl-row": "" },
          h("input", { "data-fl-input": "", value: personDraft.name, placeholder: "\u59D3\u540D\uFF0C\u4F8B\u5982\uFF1A\u5C0F\u6EE1", onChange: (e) => setPersonDraft({ ...personDraft, name: e.target.value }) }),
          h("input", { "data-fl-input": "", value: personDraft.relation, placeholder: "\u5173\u7CFB\uFF0C\u4F8B\u5982\uFF1A\u5BA4\u53CB", onChange: (e) => setPersonDraft({ ...personDraft, relation: e.target.value }) }),
          h("input", { "data-fl-input": "", value: personDraft.notes, placeholder: "\u5979\u8BB0\u5F97\u7684\u7279\u70B9\uFF08\u53EF\u9009\uFF09", onChange: (e) => setPersonDraft({ ...personDraft, notes: e.target.value }) }),
          h("input", { "data-fl-input": "", value: personDraft.origin, placeholder: "\u6765\u6E90\uFF08\u5FC5\u586B\uFF09", onChange: (e) => setPersonDraft({ ...personDraft, origin: e.target.value }) }),
          h("label", { "data-fl-row": "" }, h("span", { "data-fl-note": "" }, "\u521D\u59CB\u4EB2\u8FD1\u611F"), h("input", { "data-fl-input": "", type: "number", min: 0, max: 100, value: personDraft.closeness, onChange: (e) => setPersonDraft({ ...personDraft, closeness: e.target.value }) })),
          h("button", { "data-fl-btn": "", "data-fl-main": "", disabled: busy, onClick: createPerson }, "\u8BB0\u4F4F")
        ),
        h("div", { "data-fl-note": "" }, "\u4EBA\u7269\u5FC5\u987B\u7531\u4F60\u660E\u786E\u63D0\u4F9B\uFF1B\u6A21\u578B\u53EA\u80FD\u628A\u5B9E\u9645\u6D3B\u52A8\u5173\u8054\u5230\u5DF2\u5B58\u5728\u7684\u4EBA\uFF0C\u4E0D\u80FD\u81EA\u5DF1\u6269\u5145\u901A\u8BAF\u5F55\u3002"),
        continuity?.planSync ? h(
          "div",
          { "data-fl-sync": "" },
          h(
            "div",
            null,
            h("strong", null, `${continuity.planSync.date} \u660E\u65E5\u5267\u672C`),
            h("div", { "data-fl-cont-meta": "" }, continuity.planSync.synced ? "\u5DF2\u5305\u542B\u5F53\u524D\u4E3B\u7EBF\u3001\u5F85\u529E\u3001\u7EA6\u5B9A\u548C\u4EBA\u7269" : "\u5F53\u524D\u4E8B\u9879\u6216\u4EBA\u7269\u6709\u53D8\u5316\uFF1B\u660E\u65E5\u5267\u672C\u4ECD\u662F\u65E7\u7248\u672C")
          ),
          h(
            "div",
            { "data-fl-row": "" },
            h("button", { "data-fl-btn": "", disabled: busy || continuity.planSync.synced, onClick: syncTomorrow }, continuity.planSync.synced ? "\u5DF2\u540C\u6B65" : "\u540C\u6B65\u5230\u660E\u65E5\u5267\u672C"),
            continuity.planSync.historyCount ? h("button", { "data-fl-btn": "", disabled: busy, onClick: undoTomorrowSync }, "\u64A4\u9500\u4E0A\u6B21\u540C\u6B65") : null
          )
        ) : null,
        peopleList,
        contList("threads", "\u957F\u671F\u4E3B\u7EBF"),
        contList("tasks", "\u77ED\u671F\u5F85\u529E"),
        contList("commitments", "\u7EA6\u5B9A"),
        h("div", { "data-fl-h": "" }, "\u6700\u8FD1\u53D8\u5316"),
        contState && (contState.recentChanges || []).length ? h("div", { "data-fl-cont-grid": "" }, (contState.recentChanges || []).slice(-8).reverse().map((change, i) => h(
          "div",
          { key: `${change.at}-${i}`, "data-fl-cont-card": "" },
          h("strong", null, change.reason || "\u72B6\u6001\u53D8\u5316"),
          h("div", { "data-fl-cont-meta": "" }, `${change.at ? new Date(change.at).toLocaleString() : "\u672A\u77E5\u65F6\u95F4"}${change.source ? ` \xB7 ${change.source}` : ""}`)
        ))) : h("div", { "data-fl-empty": "" }, "\u8FD8\u6CA1\u6709\u53D8\u5316\u8BB0\u5F55"),
        h("div", { "data-fl-h": "" }, "\u6BCF\u65E5\u751F\u6D3B\u8BB0\u5FC6"),
        continuity && (continuity.memories || []).length ? (continuity.memories || []).map((m) => h("div", { key: m.date, "data-fl-cont-card": "" }, h("strong", null, m.date), h("div", { "data-fl-cont-meta": "" }, m.summary))) : h("div", { "data-fl-empty": "" }, "\u8FD8\u6CA1\u6709\u5DF2\u7ED3\u7B97\u7684\u751F\u6D3B\u8BB0\u5FC6"),
        h("div", { "data-fl-row": "" }, h("button", { "data-fl-btn": "", disabled: busy, onClick: settleContinuity }, "\u7ACB\u5373\u6309\u771F\u5B9E\u65F6\u95F4\u7EBF\u7ED3\u7B97"), h("span", { "data-fl-note": "" }, "\u91CD\u590D\u6267\u884C\u662F\u5E42\u7B49\u7684\uFF0C\u4E0D\u4F1A\u91CD\u590D\u7D2F\u8BA1\u3002")),
        h("div", { "data-fl-h": "" }, "\u7ED3\u7B97\u8BBE\u7F6E"),
        h(
          "div",
          { "data-fl-row": "" },
          h("label", { "data-fl-row": "" }, h("input", { type: "checkbox", checked: config.\u8FDE\u7EED\u6027?.\u542F\u7528 !== false, onChange: (e) => patch(["\u8FDE\u7EED\u6027", "\u542F\u7528"], e.target.checked) }), "\u542F\u7528\u8FDE\u7EED\u6027"),
          h("span", { "data-fl-note": "" }, "\u7ED3\u7B97\u95F4\u9694\uFF08\u5206\u949F\uFF09"),
          h(Field, { value: config.\u8FDE\u7EED\u6027?.\u7ED3\u7B97\u95F4\u9694\u5206\u949F || 10, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u8FDE\u7EED\u6027", "\u7ED3\u7B97\u95F4\u9694\u5206\u949F"], Number(v) || 10) }),
          h("span", { "data-fl-note": "" }, "\u6BCF\u65E5\u6210\u679C\u4E0A\u9650"),
          h(Field, { value: config.\u8FDE\u7EED\u6027?.\u6BCF\u65E5\u6210\u679C\u4E0A\u9650 ?? 2, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u8FDE\u7EED\u6027", "\u6BCF\u65E5\u6210\u679C\u4E0A\u9650"], Number(v) || 0) })
        ),
        h("div", { "data-fl-warn": "" }, "\u8FB9\u754C\uFF1A\u4E0D\u6267\u884C\u73B0\u5B9E\u52A8\u4F5C\u3001\u4E0D\u81EA\u4E3B\u751F\u56FE\u3001\u4E0D\u4EFB\u610F\u64CD\u4F5C\u7528\u6237\u6587\u4EF6\uFF1B\u4E0D\u4F1A\u81EA\u4E3B\u521B\u5EFA\u957F\u671F\u4E3B\u7EBF\u6216\u4EBA\u7269\u3002")
      );
      const innerState = affect && affect.state;
      const dimensionNames = { joy: "\u6109\u60A6", calm: "\u5E73\u9759", worry: "\u62C5\u5FE7", sadness: "\u4F4E\u843D" };
      const innerPage = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-note": "" }, "\u6BCF\u4E2A\u7B26\u5408\u6761\u4EF6\u7684\u56DE\u5408\u6700\u591A\u53CD\u601D\u4E00\u6B21\uFF0C\u66F4\u65B0\u77ED\u671F\u60C5\u7EEA\u5E76\u7559\u4E0B\u53EF\u8FFD\u6EAF\u539F\u56E0\uFF1B\u53CD\u601D\u5F02\u6B65\u8FD0\u884C\uFF0C\u5931\u8D25\u4E0D\u4F1A\u6321\u4F4F\u6B63\u5E38\u804A\u5929\u3002"),
        h(
          "div",
          { "data-fl-stats": "" },
          [["\u5FC3\u60C5", innerState ? `${Math.round(innerState.valence)} \xB7 ${innerState.label}` : "\u2014"], ["\u6FC0\u6D3B\u5EA6", innerState ? Math.round(innerState.arousal) : "\u2014"], ["\u4ECA\u65E5\u53CD\u601D", affect ? `${affect.usage.attempted} / ${affect.usage.limit}` : "\u2014"], ["\u6700\u8FD1\u53D8\u5316", innerState?.lastEventAt ? new Date(innerState.lastEventAt).toLocaleString() : "\u6682\u65E0"]].map(([k, v]) => h("div", { key: k, "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, k), h("div", { "data-fl-stat-v": "", title: String(v) }, v)))
        ),
        innerState?.lastReason ? h("div", { "data-fl-warn": "" }, `\u53D8\u5316\u539F\u56E0\uFF1A${innerState.lastReason}\uFF08\u7F6E\u4FE1\u5EA6 ${Math.round((innerState.lastConfidence || 0) * 100)}%\uFF09`) : null,
        h("div", { "data-fl-h": "" }, "\u60C5\u7EEA\u7EF4\u5EA6"),
        h("div", { "data-fl-cont-grid": "" }, Object.entries(innerState && innerState.dimensions || {}).map(([key, value]) => h(
          "div",
          { key, "data-fl-cont-card": "" },
          h("strong", null, `${dimensionNames[key] || key} ${Math.round(value)}`),
          h("div", { "data-fl-meter": "" }, h("i", { style: { width: `${Math.max(0, Math.min(100, value))}%` } }))
        ))),
        h("div", { "data-fl-h": "" }, "\u53CD\u601D\u8BBE\u7F6E"),
        h(
          "div",
          { "data-fl-row": "" },
          h("label", { "data-fl-row": "" }, h("input", { type: "checkbox", checked: config.\u5185\u5728?.\u542F\u7528 !== false, onChange: (e) => patch(["\u5185\u5728", "\u542F\u7528"], e.target.checked) }), "\u542F\u7528\u539F\u751F\u5185\u5728\u72B6\u6001"),
          h("span", { "data-fl-note": "" }, "\u6A21\u5F0F"),
          h(
            "select",
            { "data-fl-input": "", value: config.\u5185\u5728?.\u53CD\u601D\u6A21\u5F0F || "\u91CD\u8981\u56DE\u5408", onChange: (e) => patch(["\u5185\u5728", "\u53CD\u601D\u6A21\u5F0F"], e.target.value) },
            h("option", { value: "\u5173\u95ED" }, "\u5173\u95ED\u53CD\u601D"),
            h("option", { value: "\u91CD\u8981\u56DE\u5408" }, "\u91CD\u8981\u56DE\u5408"),
            h("option", { value: "\u6BCF\u8F6E" }, "\u6BCF\u8F6E")
          ),
          h("span", { "data-fl-note": "" }, "\u6BCF\u65E5\u4E0A\u9650"),
          h(Field, { value: config.\u5185\u5728?.\u6BCF\u65E5\u53CD\u601D\u4E0A\u9650 || 30, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u5185\u5728", "\u6BCF\u65E5\u53CD\u601D\u4E0A\u9650"], Number(v) || 30) }),
          h("span", { "data-fl-note": "" }, "\u56DE\u7A33\u534A\u8870\u671F\uFF08\u5C0F\u65F6\uFF09"),
          h(Field, { value: config.\u5185\u5728?.\u56DE\u7A33\u534A\u8870\u671F\u5C0F\u65F6 || 8, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u5185\u5728", "\u56DE\u7A33\u534A\u8870\u671F\u5C0F\u65F6"], Number(v) || 8) })
        ),
        h(
          "div",
          { "data-fl-row": "" },
          h("span", { "data-fl-note": "" }, "\u57FA\u7EBF\u5FC3\u60C5"),
          h(Field, { value: config.\u5185\u5728?.\u57FA\u7EBF\u5FC3\u60C5 || 55, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u5185\u5728", "\u57FA\u7EBF\u5FC3\u60C5"], Number(v) || 55) }),
          h("span", { "data-fl-note": "" }, "\u6CE8\u5165\u9608\u503C"),
          h(Field, { value: config.\u5185\u5728?.\u6CE8\u5165\u9608\u503C || 6, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u5185\u5728", "\u6CE8\u5165\u9608\u503C"], Number(v) || 6) }),
          h("span", { "data-fl-note": "" }, "\u8D85\u65F6\uFF08\u79D2\uFF09"),
          h(Field, { value: config.\u5185\u5728?.\u53CD\u601D\u8D85\u65F6\u79D2 || 45, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u5185\u5728", "\u53CD\u601D\u8D85\u65F6\u79D2"], Number(v) || 45) }),
          h("button", { "data-fl-btn": "", disabled: busy, onClick: resetInner }, "\u91CD\u7F6E\u5230\u57FA\u7EBF")
        ),
        h(
          "div",
          { "data-fl-row": "" },
          h("input", { "data-fl-input": "", value: config.\u5185\u5728?.\u53CD\u601DProvider || "", placeholder: "\u53CD\u601D Provider\uFF08\u7559\u7A7A\u8DDF\u968F\u4F1A\u8BDD\uFF09", onChange: (e) => patch(["\u5185\u5728", "\u53CD\u601DProvider"], e.target.value) }),
          h("input", { "data-fl-input": "", value: config.\u5185\u5728?.\u53CD\u601D\u6A21\u578B || "", placeholder: "\u53CD\u601D\u6A21\u578B\uFF08\u7559\u7A7A\u8DDF\u968F\u4F1A\u8BDD\uFF09", onChange: (e) => patch(["\u5185\u5728", "\u53CD\u601D\u6A21\u578B"], e.target.value) })
        ),
        h("div", { "data-fl-note": "" }, affect?.privacy || "\u672C\u5730\u4E0D\u4FDD\u5B58\u5BF9\u8BDD\u539F\u6587\u3002"),
        h("div", { "data-fl-h": "" }, "\u7EDF\u4E00\u4E8B\u4EF6\u8D26\u672C"),
        affect && affect.events?.length ? h("div", { "data-fl-cont-grid": "" }, affect.events.map((item) => h(
          "div",
          { key: item.id, "data-fl-cont-card": "", "data-fl-event": "", "data-status": item.status },
          h("strong", null, new Date(item.at).toLocaleString(), h("span", { "data-fl-event-type": "" }, item.type === "life.settled" ? "\u751F\u6D3B\u7ED3\u7B97" : item.type === "turn.reflection" ? "\u56DE\u5408\u53CD\u601D" : "\u72B6\u6001\u64CD\u4F5C")),
          h("div", { "data-fl-cont-meta": "" }, `${item.reason || "\u65E0\u539F\u56E0"} \xB7 ${item.status}${item.model ? ` \xB7 ${item.model}` : ""}`),
          item.memoryCandidates?.length ? h("div", { "data-fl-cont-meta": "" }, `\u8BB0\u5FC6\u5019\u9009\uFF08\u5DF2\u4EA4\u7531\u4EBA\u683C\u7B56\u7565\uFF09\uFF1A${item.memoryCandidates.map((x) => x.summary).join("\uFF1B")}`) : null
        ))) : h("div", { "data-fl-empty": "" }, "\u8FD8\u6CA1\u6709\u53CD\u601D\u6216\u751F\u6D3B\u7ED3\u7B97\u8BB0\u5F55"),
        h("div", { "data-fl-warn": "" }, "\u8FB9\u754C\uFF1A\u4E8B\u4EF6\u8D26\u672C\u4E0D\u4FDD\u5B58\u5BF9\u8BDD\u539F\u6587\uFF1B\u5019\u9009\u5FC5\u987B\u7ECF\u8FC7\u4EBA\u683C\u9875\u7684\u7F6E\u4FE1\u5EA6\u3001\u91CD\u8981\u5EA6\u548C\u654F\u611F\u4FE1\u606F\u7B56\u7565\uFF0C\u624D\u53EF\u80FD\u5F62\u6210\u53EF\u6DE1\u5FD8\u7684\u957F\u671F\u8BB0\u5FC6\u3002")
      );
      const sharingCfg = config.\u4E3B\u52A8\u5206\u4EAB || {};
      const sharePage = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-note": "" }, "\u53EA\u5206\u4EAB\u5DF2\u7ECF\u53D1\u751F\u3001\u80FD\u8FFD\u6EAF\u5230\u751F\u6D3B\u7EBF\u7684\u4E8B\uFF1A\u5C0F\u4E8B\u8FDB\u5165\u4E0B\u4E00\u9636\u6BB5\u3001\u521A\u5B8C\u6210\u7684\u51FA\u884C/\u5403\u996D/\u4E0A\u8BFE\u3001\u8EAB\u4F53\u53D8\u5316\uFF0C\u6216\u4E4B\u524D\u63D0\u8FC7\u7684\u4E8B\u60C5\u6709\u4E86\u540E\u7EED\u3002\u672A\u6765\u8BA1\u5212\u4E0D\u4F1A\u89E6\u53D1\uFF1B\u6CA1\u6709\u5408\u9002\u5019\u9009\u65F6\u4FDD\u6301\u5B89\u9759\u3002"),
        h(
          "div",
          { "data-fl-row": "" },
          h("label", { "data-fl-row": "" }, h("input", { type: "checkbox", checked: sharingCfg.\u542F\u7528 !== false, onChange: (e) => patch(["\u4E3B\u52A8\u5206\u4EAB", "\u542F\u7528"], e.target.checked) }), "\u542F\u7528\u4E3B\u52A8\u5206\u4EAB"),
          h("span", { "data-fl-note": "" }, "\u6BCF\u65E5\u4E0A\u9650"),
          h(Field, { value: sharingCfg.\u6BCF\u65E5\u4E0A\u9650 ?? 2, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u4E3B\u52A8\u5206\u4EAB", "\u6BCF\u65E5\u4E0A\u9650"], Number(v) || 0) }),
          h("span", { "data-fl-note": "" }, "\u5168\u5C40\u51B7\u5374\u5206\u949F"),
          h(Field, { value: sharingCfg.\u5168\u5C40\u51B7\u5374\u5206\u949F ?? 1440, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u4E3B\u52A8\u5206\u4EAB", "\u5168\u5C40\u51B7\u5374\u5206\u949F"], Number(v) || 1440) })
        ),
        h(
          "div",
          { "data-fl-row": "" },
          h("span", { "data-fl-note": "" }, "\u540C\u7C7B\u51B7\u5374\u5206\u949F"),
          h(Field, { value: sharingCfg.\u540C\u7C7B\u51B7\u5374\u5206\u949F ?? 480, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u4E3B\u52A8\u5206\u4EAB", "\u540C\u7C7B\u51B7\u5374\u5206\u949F"], Number(v) || 480) }),
          h("span", { "data-fl-note": "" }, "\u5B89\u9759\u5F00\u59CB"),
          h(Field, { value: sharingCfg.\u5B89\u9759\u5F00\u59CB ?? 0, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u4E3B\u52A8\u5206\u4EAB", "\u5B89\u9759\u5F00\u59CB"], Number(v) || 0) }),
          h("span", { "data-fl-note": "" }, "\u5B89\u9759\u7ED3\u675F"),
          h(Field, { value: sharingCfg.\u5B89\u9759\u7ED3\u675F ?? 8, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u4E3B\u52A8\u5206\u4EAB", "\u5B89\u9759\u7ED3\u675F"], Number(v) || 8) })
        ),
        h(
          "div",
          { "data-fl-row": "" },
          h("span", { "data-fl-note": "" }, "\u6700\u4F4E\u5206"),
          h(Field, { value: sharingCfg.\u6700\u4F4E\u5206 ?? 84, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u4E3B\u52A8\u5206\u4EAB", "\u6700\u4F4E\u5206"], Number(v) || 0) }),
          h("span", { "data-fl-note": "" }, "\u521A\u804A\u8FC7\u591A\u5C11\u5206\u949F\u5185\u4E0D\u5206\u4EAB"),
          h(Field, { value: sharingCfg.\u8FD1\u671F\u5BF9\u8BDD\u5206\u949F ?? 20, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u4E3B\u52A8\u5206\u4EAB", "\u8FD1\u671F\u5BF9\u8BDD\u5206\u949F"], Number(v) || 20) }),
          h("button", { "data-fl-btn": "", disabled: busy || sharingCfg.\u542F\u7528 === false, onClick: triggerInitiative }, "\u73B0\u5728\u68C0\u67E5\u4E00\u6B21")
        ),
        h("div", { "data-fl-note": "" }, "\u9ED8\u8BA4\u4F4E\u6253\u6270\uFF1A\u4E00\u5929\u6700\u591A\u4E24\u6B21\uFF0C\u5176\u4E2D\u4E00\u6B21\u53EF\u4EE5\u7559\u7ED9\u540C\u4E00\u4EF6\u5C0F\u4E8B\u7684\u540E\u7EED\uFF1B\u5168\u5C40\u51B7\u5374 24 \u5C0F\u65F6\u3001\u540C\u7C7B\u51B7\u5374 8 \u5C0F\u65F6\u3002\u7761\u89C9\u3001\u6D17\u6FA1\u3001\u4E0A\u8BFE\u3001\u624B\u673A\u4E0D\u5728\u624B\u8FB9\u3001\u5B89\u9759\u65F6\u6BB5\u3001\u521A\u804A\u8FC7\u3001\u4F1A\u8BDD\u5FD9\u3001\u6CA1\u6709\u8FBE\u5230\u6700\u4F4E\u5206\u6216\u4ECA\u5929\u5DF2\u7ECF\u5206\u4EAB\u8FC7\u65F6\u90FD\u4F1A\u4FDD\u6301\u5B89\u9759\u3002")
      );
      const mindState = mind && mind.mind;
      const integrationText = mind ? Object.entries(mind.integrations || {}).filter(([, on]) => on).map(([key]) => ({ memory: "dsh-fish-memory", mood: "dsh-feiyu-mood", bili: "dsh-bili-subagent" })[key] || key).join("\u3001") : "";
      const personaPage = h(
        "div",
        { "data-fl-sec": "" },
        h("div", { "data-fl-note": "" }, "\u4EBA\u683C\u4E0D\u662F\u4E00\u6BB5\u56FA\u5B9A\u63D0\u793A\u8BCD\uFF1A\u6BCF\u8F6E\u8BA4\u77E5\u4F1A\u6C89\u6DC0\u53EF\u9057\u5FD8\u8BB0\u5FC6\u3001\u504F\u597D\u3001\u5173\u7CFB\u611F\u53D7\u3001\u81EA\u6211\u8BC1\u636E\u548C\u865A\u62DF\u76EE\u6807\uFF1B\u53EC\u56DE\u6309\u5F53\u524D\u8BDD\u9898\u9009\u62E9\uFF0C\u65E7\u8BB0\u5FC6\u4E0D\u80FD\u538B\u8FC7\u65B0\u6D88\u606F\u3002"),
        h(
          "div",
          { "data-fl-stats": "" },
          [["\u957F\u671F\u8BB0\u5FC6", mind?.counts?.memories], ["\u7A33\u5B9A\u504F\u597D", mind?.counts?.preferences], ["\u81EA\u8EAB\u76EE\u6807", mind?.counts?.goals], ["\u5173\u7CFB\u6A21\u578B", mind?.counts?.relationships]].map(([k, v]) => h("div", { key: k, "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, k), h("div", { "data-fl-stat-v": "" }, v ?? "\u2014")))
        ),
        h("div", { "data-fl-h": "" }, "\u81EA\u6211\u53D9\u4E8B\u4E0E\u4EF7\u503C"),
        h("textarea", { "data-fl-input": "", rows: 3, style: { width: "100%", boxSizing: "border-box" }, value: config.\u4EBA\u683C?.\u81EA\u6211\u53D9\u4E8B || "", onChange: (e) => patch(["\u4EBA\u683C", "\u81EA\u6211\u53D9\u4E8B"], e.target.value) }),
        h(
          "div",
          { "data-fl-row": "" },
          h("input", { "data-fl-input": "", style: { flex: 1 }, value: (config.\u4EBA\u683C?.\u6838\u5FC3\u7279\u8D28 || []).join("\u3001"), placeholder: "\u6838\u5FC3\u7279\u8D28\uFF0C\u7528\u987F\u53F7\u5206\u9694", onChange: (e) => patch(["\u4EBA\u683C", "\u6838\u5FC3\u7279\u8D28"], e.target.value.split(/[、,，]/).map((x) => x.trim()).filter(Boolean)) }),
          h("input", { "data-fl-input": "", style: { flex: 1 }, value: (config.\u4EBA\u683C?.\u6838\u5FC3\u4EF7\u503C || []).join("\u3001"), placeholder: "\u6838\u5FC3\u4EF7\u503C\uFF0C\u7528\u987F\u53F7\u5206\u9694", onChange: (e) => patch(["\u4EBA\u683C", "\u6838\u5FC3\u4EF7\u503C"], e.target.value.split(/[、,，]/).map((x) => x.trim()).filter(Boolean)) })
        ),
        mindState?.identity ? h("div", { "data-fl-cont-card": "" }, h("strong", null, "\u5F53\u524D\u5F62\u6210\u7684\u81EA\u6211\u8BA4\u8BC6"), h("div", { "data-fl-cont-meta": "" }, mindState.identity.narrative), h("div", { "data-fl-cont-meta": "" }, `\u7279\u8D28\uFF1A${(mindState.identity.traits || []).join("\u3001")}\uFF5C\u4EF7\u503C\uFF1A${(mindState.identity.values || []).join("\u3001")}`)) : null,
        h("div", { "data-fl-h": "" }, "\u8BB0\u5FC6\u7B56\u7565"),
        h(
          "div",
          { "data-fl-row": "" },
          h("label", { "data-fl-row": "" }, h("input", { type: "checkbox", checked: config.\u4EBA\u683C?.\u542F\u7528 !== false, onChange: (e) => patch(["\u4EBA\u683C", "\u542F\u7528"], e.target.checked) }), "\u542F\u7528\u5B8C\u6574\u4EBA\u683C"),
          h("label", { "data-fl-row": "" }, h("input", { type: "checkbox", checked: config.\u4EBA\u683C?.\u8BB0\u5FC6\u542F\u7528 !== false, onChange: (e) => patch(["\u4EBA\u683C", "\u8BB0\u5FC6\u542F\u7528"], e.target.checked) }), "\u542F\u7528\u957F\u671F\u8BB0\u5FC6"),
          h("label", { "data-fl-row": "" }, h("input", { type: "checkbox", checked: config.\u4EBA\u683C?.\u81EA\u52A8\u6C89\u6DC0 !== false, onChange: (e) => patch(["\u4EBA\u683C", "\u81EA\u52A8\u6C89\u6DC0"], e.target.checked) }), "\u81EA\u52A8\u6C89\u6DC0\u9AD8\u8D28\u91CF\u5019\u9009"),
          h("span", { "data-fl-note": "" }, "\u53EC\u56DE\u6761\u6570"),
          h(Field, { value: config.\u4EBA\u683C?.\u53EC\u56DE\u6761\u6570 || 6, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u4EBA\u683C", "\u53EC\u56DE\u6761\u6570"], Number(v) || 6) }),
          h("span", { "data-fl-note": "" }, "\u5B57\u6570\u4E0A\u9650"),
          h(Field, { value: config.\u4EBA\u683C?.\u53EC\u56DE\u5B57\u6570 || 800, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u4EBA\u683C", "\u53EC\u56DE\u5B57\u6570"], Number(v) || 800) })
        ),
        h(
          "div",
          { "data-fl-row": "" },
          h("span", { "data-fl-note": "" }, "\u91CD\u8981\u5EA6\u95E8\u69DB"),
          h(Field, { value: config.\u4EBA\u683C?.\u8BB0\u5FC6\u91CD\u8981\u5EA6\u9608\u503C ?? 0.68, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u4EBA\u683C", "\u8BB0\u5FC6\u91CD\u8981\u5EA6\u9608\u503C"], Number(v)) }),
          h("span", { "data-fl-note": "" }, "\u7F6E\u4FE1\u5EA6\u95E8\u69DB"),
          h(Field, { value: config.\u4EBA\u683C?.\u8BB0\u5FC6\u7F6E\u4FE1\u5EA6\u9608\u503C ?? 0.72, type: "number", width: "data-fl-num", onChange: (v) => patch(["\u4EBA\u683C", "\u8BB0\u5FC6\u7F6E\u4FE1\u5EA6\u9608\u503C"], Number(v)) }),
          h("select", { "data-fl-input": "", value: config.\u4EBA\u683C?.\u5916\u90E8\u63D2\u4EF6\u517C\u5BB9 || "\u5185\u5EFA\u4F18\u5148", onChange: (e) => patch(["\u4EBA\u683C", "\u5916\u90E8\u63D2\u4EF6\u517C\u5BB9"], e.target.value) }, h("option", { value: "\u5185\u5EFA\u4F18\u5148" }, "\u5185\u5EFA\u4EBA\u683C\u4F18\u5148"), h("option", { value: "\u5916\u90E8\u4F18\u5148" }, "\u5916\u90E8\u63D2\u4EF6\u4F18\u5148"))
        ),
        integrationText ? h("div", { "data-fl-warn": "" }, `\u68C0\u6D4B\u5230\uFF1A${integrationText}\u3002\u9009\u62E9\u201C\u5916\u90E8\u4F18\u5148\u201D\u53EF\u6291\u5236\u91CD\u53E0\u7684\u5185\u5EFA\u5FC3\u60C5\u6216\u8BB0\u5FC6\uFF1BB\u7AD9\u5B50\u4EE3\u7406\u53EA\u4F5C\u4E3A\u4E8B\u4EF6\u6765\u6E90\uFF0C\u4E0D\u88AB\u66FF\u4EE3\u3002`) : null,
        h("div", { "data-fl-h": "" }, "\u660E\u786E\u6DFB\u52A0\u8BB0\u5FC6"),
        h("div", { "data-fl-row": "" }, h("input", { "data-fl-input": "", style: { flex: 1 }, value: memoryDraft, placeholder: "\u4E00\u6761\u53EF\u72EC\u7ACB\u7406\u89E3\u7684\u4E8B\u5B9E\u6216\u7ECF\u5386", onChange: (e) => setMemoryDraft(e.target.value) }), h("button", { "data-fl-btn": "", "data-fl-main": "", disabled: busy || !memoryDraft.trim(), onClick: async () => {
          if (await mindAction("/mind/memory", { action: "create", summary: memoryDraft, kind: "fact", subject: "world", pinned: true, importance: 1 })) setMemoryDraft("");
        } }, "\u8BB0\u4F4F")),
        mindState?.memories?.length ? h("div", { "data-fl-cont-grid": "" }, mindState.memories.slice().reverse().slice(0, 30).map((item) => h("div", { key: item.id, "data-fl-cont-card": "" }, h("strong", null, item.summary), h("div", { "data-fl-cont-meta": "" }, `${item.kind} \xB7 \u91CD\u8981\u5EA6 ${Math.round(item.importance * 100)}% \xB7 ${item.status} \xB7 \u6765\u6E90 ${item.source}`), h("div", { "data-fl-row": "" }, item.status === "active" ? h("button", { "data-fl-del": "", onClick: () => mindAction("/mind/memory", { action: "forget", id: item.id }) }, "\u6DE1\u5FD8") : h("button", { "data-fl-btn": "", onClick: () => mindAction("/mind/memory", { action: "restore", id: item.id }) }, "\u6062\u590D"), h("button", { "data-fl-del": "", onClick: () => window.confirm("\u6C38\u4E45\u5220\u9664\u540E\u4E0D\u4F1A\u4FDD\u7559\u5728\u6062\u590D\u5907\u4EFD\u4E2D\uFF0C\u786E\u5B9A\u5417\uFF1F") && mindAction("/mind/memory", { action: "delete", id: item.id }) }, "\u6C38\u4E45\u5220\u9664"))))) : h("div", { "data-fl-empty": "" }, "\u8FD8\u6CA1\u6709\u957F\u671F\u8BB0\u5FC6"),
        h("div", { "data-fl-h": "" }, "\u504F\u597D\u4E0E\u5173\u7CFB"),
        h("div", { "data-fl-row": "" }, h("select", { "data-fl-input": "", value: preferenceDraft.owner, onChange: (e) => setPreferenceDraft({ ...preferenceDraft, owner: e.target.value }) }, h("option", { value: "self" }, "\u89D2\u8272\u504F\u597D"), h("option", { value: "user" }, "\u7528\u6237\u504F\u597D")), h("input", { "data-fl-input": "", value: preferenceDraft.key, placeholder: "\u65B9\u9762\uFF0C\u5982\u996E\u6599", onChange: (e) => setPreferenceDraft({ ...preferenceDraft, key: e.target.value }) }), h("input", { "data-fl-input": "", value: preferenceDraft.value, placeholder: "\u5185\u5BB9\uFF0C\u5982\u504F\u7231\u5C11\u7CD6", onChange: (e) => setPreferenceDraft({ ...preferenceDraft, value: e.target.value }) }), h("button", { "data-fl-btn": "", disabled: busy, onClick: async () => {
          if (await mindAction("/mind/preference", { action: "create", ...preferenceDraft })) setPreferenceDraft({ owner: "self", key: "", value: "" });
        } }, "\u6DFB\u52A0")),
        h("div", { "data-fl-cont-grid": "" }, [...(mindState?.preferences || []).filter((x) => x.status === "active").map((x) => ({ id: x.id, title: `${x.owner === "self" ? "\u5979" : "\u7528\u6237"}\u7684${x.key}`, detail: x.value, type: "preference" })), ...(mindState?.relationships || []).map((x) => ({ id: x.id, title: x.name, detail: `${x.summary || "\u666E\u901A\u76F8\u5904"}\uFF5C\u6E29\u6696 ${Math.round(x.warmth)} \xB7 \u4FE1\u4EFB ${Math.round(x.trust)} \xB7 \u7D27\u5F20 ${Math.round(x.tension)}`, type: "relationship" }))].map((x) => h("div", { key: `${x.type}-${x.id}`, "data-fl-cont-card": "" }, h("strong", null, x.title), h("div", { "data-fl-cont-meta": "" }, x.detail), x.type === "preference" ? h("button", { "data-fl-del": "", onClick: () => window.confirm("\u6C38\u4E45\u5220\u9664\u8FD9\u6761\u504F\u597D\uFF1F") && mindAction("/mind/preference", { action: "delete", id: x.id }) }, "\u6C38\u4E45\u5220\u9664") : null))),
        h("div", { "data-fl-h": "" }, "\u81EA\u8EAB\u76EE\u6807"),
        h("div", { "data-fl-row": "" }, h("input", { "data-fl-input": "", value: goalDraft.title, placeholder: "\u865A\u62DF\u6216\u63D2\u4EF6\u672C\u5730\u76EE\u6807", onChange: (e) => setGoalDraft({ ...goalDraft, title: e.target.value }) }), h("input", { "data-fl-input": "", value: goalDraft.nextStep, placeholder: "\u4E0B\u4E00\u6B65", onChange: (e) => setGoalDraft({ ...goalDraft, nextStep: e.target.value }) }), h("select", { "data-fl-input": "", value: goalDraft.scope, onChange: (e) => setGoalDraft({ ...goalDraft, scope: e.target.value }) }, h("option", { value: "virtual" }, "\u865A\u62DF\u610F\u56FE"), h("option", { value: "local" }, "\u63D2\u4EF6\u672C\u5730\u6210\u679C")), h("button", { "data-fl-btn": "", disabled: busy || !goalDraft.title.trim(), onClick: async () => {
          if (await mindAction("/mind/goal", { action: "create", ...goalDraft })) setGoalDraft({ title: "", reason: "", nextStep: "", scope: "virtual" });
        } }, "\u6DFB\u52A0")),
        mindState?.goals?.length ? h("div", { "data-fl-cont-grid": "" }, mindState.goals.map((x) => h("div", { key: x.id, "data-fl-cont-card": "" }, h("strong", null, x.title), h("div", { "data-fl-cont-meta": "" }, `${x.status} \xB7 ${Math.round(x.progress)}% \xB7 ${x.scope}${x.nextStep ? ` \xB7 \u4E0B\u4E00\u6B65 ${x.nextStep}` : ""}`), h("div", { "data-fl-row": "" }, x.status === "active" ? h("button", { "data-fl-btn": "", onClick: () => mindAction("/mind/goal", { action: "complete", id: x.id }) }, "\u5B8C\u6210") : null, h("button", { "data-fl-del": "", onClick: () => window.confirm("\u6C38\u4E45\u5220\u9664\u8FD9\u4E2A\u76EE\u6807\uFF1F") && mindAction("/mind/goal", { action: "delete", id: x.id }) }, "\u6C38\u4E45\u5220\u9664"))))) : h("div", { "data-fl-empty": "" }, "\u8FD8\u6CA1\u6709\u81EA\u8EAB\u76EE\u6807"),
        h("div", { "data-fl-h": "" }, "\u4E3B\u52A8\u5206\u4EAB"),
        h("div", { "data-fl-note": "" }, "\u4E3B\u52A8\u5206\u4EAB\u5DF2\u7EDF\u4E00\u5230\u300C\u5206\u4EAB\u300D\u9875\u7B7E\uFF1A\u53EA\u4ECE\u5DF2\u7ECF\u53D1\u751F\u7684\u5C0F\u4E8B\u3001\u5B8C\u6210\u7684\u6D3B\u52A8\u3001\u8EAB\u4F53\u53D8\u5316\u548C\u53EF\u8FFD\u6EAF\u7684\u540E\u7EED\u91CC\u6311\uFF0C\u65E7\u7684\u6CDB\u4E3B\u52A8\u4E0D\u518D\u5355\u72EC\u8C03\u5EA6\u3002"),
        h("div", { "data-fl-warn": "" }, "\u8FB9\u754C\uFF1A\u4E0D\u4F1A\u81EA\u4E3B\u8054\u7CFB\u7B2C\u4E09\u65B9\u3001\u6D88\u8D39\u3001\u53D1\u5E16\u3001\u64CD\u4F5C\u4EFB\u610F\u6587\u4EF6\u6216\u58F0\u79F0\u73B0\u5B9E\u4EFB\u52A1\u5DF2\u5B8C\u6210\uFF1B\u654F\u611F\u5019\u9009\u4E0D\u4F1A\u81EA\u52A8\u6C89\u6DC0\u3002\u6DE1\u5FD8\u53EF\u6062\u590D\uFF0C\u6C38\u4E45\u5220\u9664\u4F1A\u540C\u6B65\u6E05\u7406\u4EBA\u683C\u6062\u590D\u5907\u4EFD\u3002")
      );
      const planMeta = meta && meta.plan || {};
      const detour = meta && meta.deviation && (meta.deviation.flat ? "\u8EBA\u5E73" : meta.deviation.outing ? "\u4E34\u65F6\u51FA\u95E8" : meta.deviation.skipAfternoon ? "\u7FD8\u4E0B\u5348\u8BFE" : "");
      return h(
        "div",
        { "data-fl-wrap": "" },
        h(
          "div",
          { "data-fl-hero": "" },
          h("div", { "data-fl-title": "" }, "\u9C7C\u7684\u751F\u6D3B"),
          h("div", { "data-fl-subtitle": "" }, "\u8BA9\u89D2\u8272\u62E5\u6709\u4F1A\u81EA\u7136\u6D41\u52A8\u7684\u4E00\u5929\uFF1B\u8BA1\u5212\u3001\u4E34\u65F6\u8C03\u6574\u548C\u76F8\u673A\u5171\u7528\u540C\u4E00\u4EFD\u771F\u5B9E\u72B6\u6001\u3002"),
          h(
            "div",
            { "data-fl-stats": "" },
            h("div", { "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, "\u6B64\u523B"), h("div", { "data-fl-stat-v": "", title: current && current.what }, current && current.what || "\u7B49\u5F85\u72B6\u6001")),
            h("div", { "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, "\u4ECA\u5929"), h("div", { "data-fl-stat-v": "" }, meta && meta.dayType && meta.dayType.name || "\u5E73\u5E38")),
            h("div", { "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, "\u4F4D\u7F6E"), h("div", { "data-fl-stat-v": "" }, world && world.location && world.location.name || "\u672A\u77E5")),
            h("div", { "data-fl-stat": "" }, h("div", { "data-fl-stat-k": "" }, "\u4ECA\u65E5\u5267\u672C"), h("div", { "data-fl-stat-v": "", title: planMeta.title || "" }, detour || (planMeta.source === "llm" ? "\u6A21\u578B\u751F\u6210" : planMeta.source === "template" ? "\u672C\u5730\u6A21\u677F" : "\u5373\u65F6\u9884\u89C8")))
          )
        ),
        h(
          "div",
          { "data-fl-actions": "" },
          h("button", { "data-fl-btn": "", "data-fl-main": "", disabled: busy, onClick: save }, busy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58"),
          h("button", { "data-fl-btn": "", disabled: busy, onClick: reload }, "\u91CD\u65B0\u8BFB\u53D6"),
          tab === "now" ? h("button", { "data-fl-btn": "", disabled: busy, onClick: regenerate }, "\u91CD\u65B0\u751F\u6210\u4ECA\u65E5\u5267\u672C") : null,
          tab === "now" ? h("button", {
            "data-fl-btn": "",
            disabled: busy || !(meta && meta.planHistoryCount),
            onClick: undoRegenerate,
            title: meta && meta.planHistoryCount ? `\u53EF\u6062\u590D ${meta.planHistoryCount} \u4E2A\u5386\u53F2\u7248\u672C` : "\u6682\u65E0\u53EF\u6062\u590D\u7248\u672C"
          }, "\u64A4\u9500\u4E0A\u6B21\u91CD\u751F\u6210") : null,
          dirty ? h("span", { "data-fl-dirty": "" }, "\u6709\u672A\u4FDD\u5B58\u4FEE\u6539") : null,
          h("span", { "data-fl-msg": "" }, message)
        ),
        issues.length ? h(
          "div",
          { "data-fl-warn": "" },
          h("strong", null, "\u914D\u7F6E\u68C0\u67E5\u63D0\u793A\uFF1A"),
          " " + issues.slice(0, 4).join("\uFF1B") + (issues.length > 4 ? `\uFF1B\u53E6\u6709 ${issues.length - 4} \u9879` : "")
        ) : null,
        h("div", { "data-fl-tabs": "", role: "tablist", "aria-label": "\u9C7C\u7684\u751F\u6D3B\u9875\u9762" }, tabs.map(([k, t]) => h("button", {
          key: k,
          "data-fl-tab": "",
          role: "tab",
          "aria-selected": group === k ? "true" : "false",
          "data-fl-on": group === k ? "" : void 0,
          onClick: () => {
            setGroup(k);
            setTab(firstTabForGroup(k));
          }
        }, t))),
        (groupSections[group] || []).length > 0 ? h("div", { "data-fl-subtabs": "", role: "tablist", "aria-label": "\u751F\u6D3B\u9875\u9762\u5206\u533A" }, groupSections[group].map(([k, t]) => h("button", {
          key: k,
          "data-fl-subtab": "",
          role: "tab",
          "aria-selected": tab === k ? "true" : "false",
          "data-fl-on": tab === k ? "" : void 0,
          onClick: () => setTab(k)
        }, t))) : null,
        tab === "now" ? nowPage : null,
        tab === "share" ? sharePage : null,
        tab === "persona" ? personaPage : null,
        tab === "inner" ? innerPage : null,
        tab === "continuity" ? continuityPage : null,
        tab === "replay" ? replayPage : null,
        tab === "map" ? mapPage : null,
        tab === "year" ? yearPage : null,
        tab === "week" ? weekPage : null,
        tab === "day" ? dayPage : null,
        tab === "body" ? bodyPage : null,
        tab === "photo" ? h(ImagePanel.Panel) : null,
        tab === "data" ? dataPage : null,
        h("div", { "data-fl-msg": "" }, message)
      );
    }
    function FeiyuSidebarIcon({ size = 16 }) {
      return h(FeiyuMark, { size });
    }
    function FeiyuPage() {
      return h("div", {
        style: { height: "100%", overflowY: "auto", overflowX: "hidden", padding: "20px 24px 48px", boxSizing: "border-box" }
      }, h(Panel));
    }
    return {
      inject: ["slots"],
      __test: {
        CSS,
        Panel,
        WorldMap,
        IconifyGlyph,
        PlaceGlyph,
        behaviorMeta,
        placeIconOptions,
        replayFrameAt,
        firstTabForGroup,
        isSupportedSettingsBackup,
        ImagePanel: ImagePanel.Panel,
        imageCSS: ImagePanel.CSS
      },
      apply(ctx) {
        const style = document.createElement("style");
        style.setAttribute("data-plugin-css", "dsh-feiyu-life");
        style.textContent = CSS;
        document.head.appendChild(style);
        ctx.effect(() => () => style.remove(), "dsh-feiyu-life: settings css");
        const style2 = document.createElement("style");
        style2.setAttribute("data-plugin-css", "dsh-feiyu-image");
        style2.textContent = ImagePanel.CSS;
        document.head.appendChild(style2);
        ctx.effect(() => () => style2.remove(), "dsh-feiyu-image: settings css");
        const slots = (typeof ctx.get === "function" ? ctx.get("slots") : void 0) || ctx.slots;
        if (!slots) return;
        slots.inject("settings.section", () => slots.register(
          { name: "settings.section", id: "feiyu-life", order: 56, label: "\u9C7C\u7684\u751F\u6D3B" },
          () => h(Panel)
        ));
        try {
          const inject = ctx.inject;
          if (typeof inject === "function") {
            inject.call(ctx, ["layout"], (pageCtx) => {
              const pageSlots = pageCtx.slots;
              const layout = pageCtx.layout;
              if (!pageSlots || !layout) return void 0;
              const PAGE_ID = "feiyu-life";
              const stopMain = pageSlots.inject("main", () => pageSlots.register(
                { name: "main", key: PAGE_ID },
                FeiyuPage
              ));
              const stopSidebar = pageSlots.inject("sidebar.panellist", () => pageSlots.register({
                name: "sidebar.panellist",
                id: PAGE_ID,
                order: 11,
                label: "\u9C7C\u7684\u751F\u6D3B"
              }, FeiyuSidebarIcon));
              return () => {
                stopSidebar();
                stopMain();
              };
            });
          }
        } catch (e) {
        }
      }
    };
  }

  // src/ui/client.js
  window.__ModuleLoader__.load({ id: "dsh-feiyu-life", factory: (require2) => createUI(require2) });
})();
