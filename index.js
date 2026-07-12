(() => {
const Saiko = window.Saiko.createOnce();
let vm, core;

Saiko.on("setPopup", (bool) => {
    vm.ui.popup = bool;
});

Saiko.on("showLayout", (which, value) => {
    switch(which) {
        case (0): {
            vm.ui.screen = value;
            break;
        }
        case (1): {
            vm.ui.subscreen = value;
            break;
        }
    }
});

Saiko.on("showTopicLinks", id => {
    const { topics, indexes } = core.overview;
    
    const topic = topics.find(t => t.id == id);
    topic.links = indexes.filter(d => d.topic == id);
    vm.topic = topic;
    
    vm.ui.subscreen = 1;
    vm.ui.screen = 1;
});

Saiko.on("hideResults", () => {
    vm.ui.no_result = false;
    vm.ui.blur_count += 1;
    if(vm.ui.blur_count == 2 && vm.search_results.length > 0) {
        vm.search_results = [];
    }
});

Saiko.on("createLink", (...path) => {
    return "/p/" + path.join("/");
});

Saiko.on("createSearchLink", (query) => {
    return "/p/" + vm.namespace + "?q=" + encodeURIComponent(query); 
});

Saiko.on("sendContactMessage", async () => {
    vm.ui.contact_alert = null;
    
    if(vm.ui.sending || vm.contact.is_muted) return;
    if(!vm.contact.allow_sending) {
        vm.ui.contact_alert = "Please wait for the customer support to reply before sending again.";
        return;
    }
    
    const content = vm.fields.contact.trim();
    if(content.length == 0) return;
    if(content.length > 400) {
        vm.ui.contact_alert = "Message too long";
        return;
    }
    vm.ui.sending = true;
    
    try {
        await core.writeMessage(content);
        vm.fields.contact = "";
        vm.ui.sending = false;
        vm.contact = await getContactBubbles();
    } catch(err) {
        vm.ui.contact_alert = "Something went wrong. Please try again later.";
        console.error(err);
    }
});

Saiko.on("formatDate", (timestamp) => {
    return Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    }).format(timestamp);
});

Saiko.on("search", () => {
    const query = vm.fields.search.trim();
    vm.search_results = [];
    vm.ui.no_result = false;
    if(query.length == 0) return;
    
    const results = core.searchPages(query).map(item => {
        return {
            title: item.name,
            subtitle: core.overview.topics.find(t => t.id == item.topic).name
                + " | " + item.tags.join(", "),
            url: `/${core.overview.namespace}/${item.slug}`
         }
    }).slice(0, 5);
    vm.search_results = results;
    vm.ui.blur_count = 0;
    vm.ui.no_result = results.length == 0;
});

async function getContactBubbles() {
    const responses = await core.getResponses();
    const outgoing = await core.idx.get("messages", []);
    const incoming = responses.messages ?? [];
    const messages = [...outgoing, ...incoming].sort((a, b) => b.sent_at - a.sent_at);
    
    // Counts how many messages sent after the last response.
    let sent_unnoticed = 0;
    for(let i = messages.length - 1; i >= 0; i--) {
        if(!messages[i].from_customer) break;
        sent_unnoticed += 1;
    }
    
    return {
        ...responses,
        allow_sending: sent_unnoticed < 2,
        is_muted: responses.mute_until > Date.now(),
        messages
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    core = createCore();
    
    Saiko.attach("ui", {
        screen: 0,
        subscreen: 0,
        popup: false,
        sending: false,
        contact_alert: null,
        no_result: false,
        blur_count: 0
    });
    
    Saiko.attach("constants", {
        NAMESPACES,
        NAMESPACE_TYPES,
        SERVER: core.NTFY_TOPIC.split("_")[1]
    });
    
    Saiko.attach("fields", {
        contact: "",
        search: ""
    });
    
    vm = Saiko.init({
        article: {},
        topic: {},
        overview: {},
        contact: {},
        search_results: [],
        namespace: null
    });
    
    await core.hotstart();
    vm.overview = core.overview ?? {};
    vm.namespace = core.overview?.namespace;
    vm.article = core.article;
    vm.topic = core.topic;
    
    // DEVELOPMENT
    // vm.overview.type = "HELP_CENTER";
    
    vm.contact = await getContactBubbles();
    vm.ui.screen = core.topic?.id ? 2 : 1;
    
    if(core.payloads.namespace
        && !core.payloads.article
        && core.payloads.topic) {
        const topic = core.overview.topics.find(t => t.id == core.payloads.topic);
        if(topic) Saiko.$showTopicLinks(topic.id);
    }
    
    if(core.payloads.namespace
        && !core.payloads.article
        && !core.payloads.topic
        && core.payloads.q) {
            vm.fields.search = core.payloads.q;
            Saiko.$search();
        }
    
    // DEVELOPMENT
    // window.vm = vm;
    // window.core = core;
});

})();