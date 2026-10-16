/* @ts-self-types="./latexsnipper_wasm.d.ts" */

/**
 * A trusted host owns this object, consent, key lifecycle and explicit feedback.
 */
export class FormulaPreferencesWasm {
    static __wrap(ptr) {
        const obj = Object.create(FormulaPreferencesWasm.prototype);
        obj.__wbg_ptr = ptr;
        FormulaPreferencesWasmFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FormulaPreferencesWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_formulapreferenceswasm_free(ptr, 0);
    }
    /**
     * @returns {any}
     */
    close() {
        const ret = wasm.formulapreferenceswasm_close(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {string} command_json
     * @returns {any}
     */
    command(command_json) {
        const ptr0 = passStringToWasm0(command_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.formulapreferenceswasm_command(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
}
if (Symbol.dispose) FormulaPreferencesWasm.prototype[Symbol.dispose] = FormulaPreferencesWasm.prototype.free;

/**
 * Browser/Node instance-local trusted JS route registry. No code is fetched.
 */
export class FormulaRegistryWasm {
    static __wrap(ptr) {
        const obj = Object.create(FormulaRegistryWasm.prototype);
        obj.__wbg_ptr = ptr;
        FormulaRegistryWasmFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FormulaRegistryWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_formularegistrywasm_free(ptr, 0);
    }
    /**
     * @returns {any}
     */
    capabilities() {
        const ret = wasm.formularegistrywasm_capabilities(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {any}
     */
    close() {
        const ret = wasm.formularegistrywasm_close(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {string} request_json
     * @param {string} policy_json
     * @returns {any}
     */
    convert(request_json, policy_json) {
        const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(policy_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.formularegistrywasm_convert(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret;
    }
    constructor() {
        const ret = wasm.formularegistrywasm_new();
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        FormulaRegistryWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {string} declaration_json
     * @param {Function} ready
     * @param {Function} convert
     * @returns {any}
     */
    register_backend(declaration_json, ready, convert) {
        const ptr0 = passStringToWasm0(declaration_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.formularegistrywasm_register_backend(this.__wbg_ptr, ptr0, len0, ready, convert);
        return ret;
    }
    /**
     * @param {string} declaration_json
     * @param {Function} validator
     * @returns {any}
     */
    register_format(declaration_json, validator) {
        const ptr0 = passStringToWasm0(declaration_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.formularegistrywasm_register_format(this.__wbg_ptr, ptr0, len0, validator);
        return ret;
    }
    /**
     * @param {string} backend
     * @param {boolean} enabled
     * @returns {any}
     */
    set_enabled(backend, enabled) {
        const ptr0 = passStringToWasm0(backend, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.formularegistrywasm_set_enabled(this.__wbg_ptr, ptr0, len0, enabled);
        return ret;
    }
}
if (Symbol.dispose) FormulaRegistryWasm.prototype[Symbol.dispose] = FormulaRegistryWasm.prototype.free;

/**
 * @returns {any}
 */
export function api_info_v3() {
    const ret = wasm.api_info_v3();
    return ret;
}

/**
 * No downgrade or retry: recheck the current catalog and policy before editing.
 * @param {string} request_json
 * @returns {any}
 */
export function apply_formula_completion_fragments_v3(request_json) {
    const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.apply_formula_completion_fragments_v3(ptr0, len0);
    return ret;
}

/**
 * Recheck CURRENT scope, definition content and editor state before acceptance.
 * @param {string} request_json
 * @returns {any}
 */
export function apply_formula_completion_scoped_v3(request_json) {
    const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.apply_formula_completion_scoped_v3(ptr0, len0);
    return ret;
}

/**
 * Returns data only; the host owns explicit acceptance, document writes and undo.
 * @param {string} request_json
 * @returns {any}
 */
export function apply_formula_completion_v3(request_json) {
    const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.apply_formula_completion_v3(ptr0, len0);
    return ret;
}

/**
 * Policy flags bind snapshots; trusted hosts must authorize retrieval first.
 * @param {string} request_json
 * @returns {any}
 */
export function complete_formula_fragments_v3(request_json) {
    const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.complete_formula_fragments_v3(ptr0, len0);
    return ret;
}

/**
 * No registry, macro expansion or IO. Pass only host-authorized definitions.
 * @param {string} request_json
 * @returns {any}
 */
export function complete_formula_scoped_v3(request_json) {
    const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.complete_formula_scoped_v3(ptr0, len0);
    return ret;
}

/**
 * Synchronous model-free query. JSON preserves all revision bits; prefer a worker.
 * @param {string} request_json
 * @returns {any}
 */
export function complete_formula_v3(request_json) {
    const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.complete_formula_v3(ptr0, len0);
    return ret;
}

/**
 * Additive bare-formula entry point; legacy `latex` still exports a document.
 * The capability describes the underlying display route; contentKind records
 * the subsequent shape-checked projection, not broader syntax/renderer support.
 * @param {string} content
 * @param {string} input_format
 * @param {string | null} [mode]
 * @returns {any}
 */
export function convert_formula_fragment_v3(content, input_format, mode) {
    const ptr0 = passStringToWasm0(content, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(input_format, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(mode) ? 0 : passStringToWasm0(mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len2 = WASM_VECTOR_LEN;
    const ret = wasm.convert_formula_fragment_v3(ptr0, len0, ptr1, len1, ptr2, len2);
    return ret;
}

/**
 * Convert a formula string without changing recognition or loaded-model state.
 * Omitted mode defaults to strict; source and reconstruction budgets apply.
 * @param {string} content
 * @param {string} input_format
 * @param {string} target_format
 * @param {string | null} [mode]
 * @returns {any}
 */
export function convert_formula_v3(content, input_format, target_format, mode) {
    const ptr0 = passStringToWasm0(content, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(input_format, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(target_format, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    var ptr3 = isLikeNone(mode) ? 0 : passStringToWasm0(mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len3 = WASM_VECTOR_LEN;
    const ret = wasm.convert_formula_v3(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    return ret;
}

/**
 * @param {string} configuration_json
 * @returns {FormulaPreferencesWasm}
 */
export function create_formula_preferences_v1(configuration_json) {
    const ptr0 = passStringToWasm0(configuration_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.create_formula_preferences_v1(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return FormulaPreferencesWasm.__wrap(ret[0]);
}

/**
 * Additive factory; app-owned Worker bridges may explicitly override it.
 * @param {string | null} [configuration_key]
 * @returns {FormulaRegistryWasm}
 */
export function create_formula_registry_v1(configuration_key) {
    var ptr0 = isLikeNone(configuration_key) ? 0 : passStringToWasm0(configuration_key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.create_formula_registry_v1(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return FormulaRegistryWasm.__wrap(ret[0]);
}

/**
 * Query model-free formula direction/mode support for the WASM target.
 * @returns {any}
 */
export function formula_capabilities_v3() {
    const ret = wasm.formula_capabilities_v3();
    return ret;
}

/**
 * @returns {any}
 */
export function formula_completion_capabilities_v3() {
    const ret = wasm.formula_completion_capabilities_v3();
    return ret;
}

/**
 * Additive profile 3: explicit host-authorized fragments, never implicit history.
 * @returns {any}
 */
export function formula_fragment_completion_capabilities_v3() {
    const ret = wasm.formula_fragment_completion_capabilities_v3();
    return ret;
}

/**
 * @returns {any}
 */
export function formula_preference_capabilities_v3() {
    const ret = wasm.formula_preference_capabilities_v3();
    return ret;
}

/**
 * Scoped v2 is additive; the v1 capability shape remains unchanged.
 * @returns {any}
 */
export function formula_scoped_completion_capabilities_v3() {
    const ret = wasm.formula_scoped_completion_capabilities_v3();
    return ret;
}

export function init() {
    wasm.init();
}

/**
 * Explicitly restore a NEW default-off owner. The host must supply current
 * trusted scope/freshness and separate storage consent; no file IO or replay.
 * @param {string} configuration_json
 * @returns {FormulaPreferencesWasm}
 */
export function restore_formula_preferences_v1(configuration_json) {
    const ptr0 = passStringToWasm0(configuration_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.restore_formula_preferences_v1(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return FormulaPreferencesWasm.__wrap(ret[0]);
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_92b29b0548f8b746: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_boolean_get_fa956cfa2d1bd751: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_is_function_1ff95bcc5517c252: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_string_ea5e6cc2e4141dfe: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_c05833b95a3cf397: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_string_get_b0ca35b86a603356: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_a6e5c5dce5018821: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_get_78f252d074a84d0b: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_length_1f0964f4a5e2c6d8: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_new_32b398fb48b6d94a: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_7796ffc7ed656783: function() {
            const ret = new Map();
            return ret;
        },
        __wbg_new_da52cf8fe3429cb2: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_with_length_e6785c33c8e4cce8: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_prototypesetcall_4770620bbe4688a0: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_set_575dd786d51585f8: function(arg0, arg1, arg2) {
            const ret = arg0.set(arg1, arg2);
            return ret;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_8a16b38e4805b298: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_static_accessor_GLOBAL_4ef717fb391d88b7: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_8d1badc68b5a74f4: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_146583524fe1469b: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_f2829a2234d7819e: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0) {
            // Cast intrinsic for `I64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000004: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./latexsnipper_wasm_bg.js": import0,
    };
}

const FormulaPreferencesWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_formulapreferenceswasm_free(ptr, 1));
const FormulaRegistryWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_formularegistrywasm_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('latexsnipper_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
