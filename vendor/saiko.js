/**
 * Saiko (2nd Ed.)
 * by Delve Delos Santos Jr.
 * 2-27-26 | under CC0-1.0 license
 * 
 * HISTORY:
 * + Added nodes
 * + Encapsulated
 * + Added listeners
 */

(() => {
let self;

const listeners = {};
const METHODS = {
    range(n) {
        return Array.from({ length: n }, (_, i) => i);
    },
    node(name, el) {
        self.nodes[name] = el;
    }
}

var app, context;
var root = document.querySelector("main");
var manifest = {
    components: {},
    mounted() {
        if(listeners.mounted) listeners.mounted();
        root.setAttribute("hydrated", "");
    },
    methods: METHODS
}

function createComponent(el, { has_shared, shared_keys }) {
    const name = el.tagName.toLowerCase();
    let props = el.getAttribute("props")?.split(",").map(y => y.trim()) ?? [];
    // Include the shared data keys
    if(has_shared) props = props.concat(shared_keys);
    
    const replica = document.createElement(el.getAttribute("model") || "section");
    replica.innerHTML = el.innerHTML;
    
    // Keep the attributes
    for(let i = 0; i < el.attributes.length; i++) {
        const { localName, value } = el.attributes.item(i);
        if(localName == "model" || localName == "props") continue;
        replica.setAttribute(localName, value);
    }
    
    el.remove();
    if(has_shared) injectShared(replica, shared_keys);
    const template = replica.outerHTML;
    
    manifest.components[name] = {
        template, props
    }
}

// Inject all the shared keys on components props.
// This way, every called components will receive the shared data.
function injectShared(e, shared_keys) {
    e.querySelectorAll("*").forEach(caller => {
        const name = caller.tagName.toLowerCase();
        if(!manifest.components[name]) return;
        
        shared_keys.forEach(k => {
            if(caller.hasAttribute(`:${k}`)) return;
            caller.setAttribute(`:${k}`, "");
        });
    });
}

// Inject all the components and methods within components itself.
// This will allow components to access methods and other defined components.
function injectComponents() {
    const components = manifest.components;
    for(const name in components) {
        const component = { ...components };
        delete component[name];
        
        manifest.components[name].components = component;
        manifest.components[name].methods = manifest.methods;
    }
}

class Saiko {
    hydrated = false;
    manifest = manifest;
    root = root;
    shared = {};
    nodes = {};
    listeners = {};
    
    // Shared data allows all components to access a data.
    attach(k, v) {
        this.shared[k] = v;
    }
    
    on(name, handler) {
        if(name.startsWith(":")) {
            listeners[name.slice(1)] = handler;
        } else {
            manifest.methods[name] = handler;
        }
        return this;
    }
    
    init(payload={}) {
        const shared_keys = Object.keys(this.shared);
        const has_shared = shared_keys.length > 0;
        
        // Produce the data including the shared data.
        manifest.data = () => {
            const pm = payload;
            for(const k in this.shared) {
                pm[k] = this.shared[k];
            }
            return pm;
        }
        
        // Process the models into components.
        document.querySelectorAll("[model]").forEach(el => {
            createComponent(el, { has_shared, shared_keys });
        });
        
        if(has_shared) injectShared(root, shared_keys);
        injectComponents();
        
        // Define all methods into the instance.
        for(const method in manifest.methods) {
            this["$" + method] = manifest.methods[method];
        }
        
        this.hydrated = true;
        this.app = Vue.createApp(manifest);
        if(listeners.app) listeners.app(this.app);
        
        this.vm = this.app.mount(root);
        return this.vm;
    }
}

let instance = new Saiko();
window.Saiko = {
    version: "1.1.0",
    createOnce() {
        const y = instance;
        if(!y) throw new Error("[Saiko] Instance can only be created once.");
        
        self = y;
        instance = null;
        return y;
    }
}

})();