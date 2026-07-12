(() => {
let core = {};
let instance, idx;

const payloads = Object.fromEntries(new URLSearchParams(location.search));
const pathnames = location.pathname.split("/").filter(p => p.length > 0);
const fingerprint = new ClientJS().getFingerprint().toString(36).toUpperCase();

async function read(file) {
    // Bypass caching to get the most updated content.
    const burst = "t=" + Date.now();
    const branch = pathnames[1];
    if(!branch) throw new Error("Namespace is not provided");
    
    const file_key = file?.split("/").pop().split(".").shift();
    const key = file ? `${branch}_${file_key}` : branch;
    
    const caches = await idx.get("cached_read", {});
    const { cache, exp } = caches[key] ?? {};
    if(cache && exp > Date.now()) return cache;
    
    const req = await fetch(`https://cdn.jsdelivr.net/gh/${USER}/${REPO}@${branch}/${branch}/${file || DEF_FILE}?${burst}`);
    const d = await req.text();
    
    if(req.status == 200) {
        caches[key] = {
            cache: d,
            exp: Date.now() + 6e5 // 10 minutes
        }
        await idx.set("cached_read", caches);
    }
    return d;
}

async function getResponses() {
    const file = `responses/${fingerprint}.json`;
    try {
        const req = await read(file);
        return JSON.parse(req);
    } catch(_) { return {} }
}

async function writeMessage(content) {
    if(!core.overview.name) throw new Error("Overview is not provided");
    
    const title = core.overview.name + " | From " + fingerprint;
    await fetch("https://ntfy.sh/" + NTFY_TOPIC, {
        method: "POST",
        body: content.toString(),
        headers: { "Title": title }
    });
    
    const messages = await idx.get("messages", []);
    messages.push({
        sent_at: Date.now(),
        from_customer: true,
        content
    });
    await idx.set("messages", messages);
}

function searchPages(query) {
    if(!core.overview) throw new Error("No overview data");
    query = sanitize(query);
    
    function sanitize(text) {
        const a = text.replace(/[^a-zA-Z0-9]/g, "");
        // If the replacement kepts 50% of the text, use it.
        // This is implemented because some artist names are straight up symbols or non-English alphabet.
        const b = a.length > Math.floor(text.length / 2) ? a : text;
        return b.trim().toLowerCase();
    }
    
    function matches(prop) {
        return sanitize(prop).includes(query);
    }
    
    return core.overview.indexes.filter(index =>
        matches(index.name)
        || matches(index.description)
        || index.tags.some(tag => matches(tag)));
}

async function fetchPage(slug) {
    const file = `pages/${slug}.md`;
    const req = await read(file);
    const [header, ...content] = req.split("-----");
    
    function parseHeaders(raw) {
        const headers = {}
        
        raw.split("\n").forEach(line => {
            if(!line.includes(":")) return;
            const [key, ...value] = line.split(":");
            headers[key.toLowerCase().replaceAll(" ", "_")] = value.join(":").trim();
        });
        
        return headers;
    }
    
    return {
        ...parseHeaders(header),
        content: marked.parse(content.join("-----"))
    }
}

async function hotstart() {
    idx = await Indexed.open("gitpress-v1");
    
    core.idx = idx;
    core.payloads = payloads;
    core.pathnames = pathnames;
    
    // DEVELOPMENT
    // payloads.namespace = "foobar";
    // payloads.article = "test3";
    // payloads.topic = "account_and_identity";
    
    const [p, namespace, article] = pathnames;
    if(p == "p" && namespace) {
        const overview = await read();
        core.overview = JSON.parse(overview);
        if(article) {
            const a = await fetchPage(article);
            a.tags = a.tags.split(",").map(t => t.trim()) ?? [];
            core.article = a;
            core.topic = core.overview.topics.find(t => t.id == a.topic);
        }
    }
}

window.createCore = () => {
    if(instance) throw new Error("Core is already created");
    core = {
        ...core,
        NTFY_TOPIC,
        
        hotstart,
        getResponses,
        writeMessage,
        searchPages,
        fetchPage
    }
    instance = core;
    return instance;
}

})();