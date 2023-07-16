const luaconf = fengari.luaconf;
const lua     = fengari.lua;
const lauxlib = fengari.lauxlib;
const lualib  = fengari.lualib;
let L = null;

function luaPrint(msg) {
	lua.lua_pushglobaltable(L);
	lua.lua_getfield(L, -1, "print");
	lua.lua_remove(L, -2);
	lua.lua_pushstring(L, msg);
	lua.lua_call(L, 1, 0);
}

function initLua() {
	L = lauxlib.luaL_newstate();
	lualib.luaL_openlibs(L);
	insertWrappers();
	insertApi();
	console.log("initialised Lua.");
}

function luaString(str) {
	let len = str.length;
	let buff = new Array(len);
	for(let i = 0; i < len; i++) {
		if (str.charCodeAt(i) > 255) buff[i] = 0x2E;
		else buff[i] = str.charCodeAt(i);
	}
	return Uint8Array.from(buff);
}

function jsString(arr) {
	let len = arr.length;
	let str = "";
	str.length = arr.length;
	for(let i = 0; i < len; i++) {
		str += String.fromCharCode(arr[i]);
	}
	return str;

}

function insertWrappers(f) {
	lua.lua_getglobal(L, "_G");
	lauxlib.luaL_setfuncs(L, {
		"print": luaPrintWrapper,
		"error": luaPrintWrapper,
		"testX": luaPrintWrapper,
		"Tracker:FindObjectForCode": luaPrintWrapper,
		//"require": luaRequireWrapper
	}, 0);
	lua.lua_pop(L, 1);
}


let apiClasses = {
	Autotracker: {
		ReadU8: luaNull
	},
	_Segment: {
		ReadUInt8: luaNull,
		ReadUInt16: luaNull
	},
	_Variant: {
		find: luaNull //OOT
	},
	_Item: {},
	_Location: {
		AddBadge: luaNull
	},
	Tracker: {
		FindObjectForCode: luaNull,
		ProviderCountForCode: luaNull,
		AddItems: luaNull,
		AddMaps: luaNull,
		AddLocations: luaNull,
		AddLayouts: luaNull,
		//ActiveVariantUID: {} //OOT
	},
	ScriptHost: {
		AddMemoryWatch: luaNull,
		PushMarkdownNotification: luaNull,
		LoadScript: luaNull
	}
}

function insertApi() {
	for(const className in apiClasses) {
		lauxlib.luaL_newlib(L, apiClasses[className]);
		lua.lua_setglobal(L, className);
	}
}

function getType(i) {
	if (i === undefined) i = -1;
	return jsString(lua.lua_typename(L, lua.lua_type(L, i)));
}

function luaValToObj(maxDepth) {
	if (maxDepth === undefined) maxDepth = 3;
	if (lua.lua_isnil(L,-1)) {
		return null;
	} else if (lua.lua_isboolean(L,-1)) {
		return lua.lua_toboolean(L,-1);
	} else if (lua.lua_isinteger(L,-1)) {
		return lua.lua_tointeger(L,-1);
	} else if (lua.lua_isnumber(L,-1)) {
		return lua.lua_tonumber(L,-1);
	} else if (lua.lua_isstring(L,-1)) {
		return lua.lua_tojsstring(L,-1);
	} else if (lua.lua_istable(L,-1)) {
		if (maxDepth > 0 || maxDepth === -1) {
			let tablePos = lua.lua_gettop(L);
			let elements = {};
			lua.lua_pushnil(L);
			while(lua.lua_next(L, tablePos) !== 0) {
				elements[lua.lua_tojsstring(L,-2)] = luaValToObj(maxDepth-1);
				lua.lua_pop(L, 1);
			}
			return elements;
		} else {
			return "[Table]";
		}
	} else if (lua.lua_isfunction(L,-1)) {
		return "[Function]";
	} else {
		console.warn("UNABLE TO DEAL WITH THIS TYPE:", getType())
		return lua.lua_tojsstring(L,-1);
	}
}

function luaPrintWrapper(L) {
	let args = [];
	while(lua.lua_gettop(L) > 0) {
		args.unshift(luaValToObj());
		lua.lua_pop(L, 1);
	}
	console.log.apply(null, args);
	return 0;
}

function luaRequireWrapper() {
	console.log("stifling all requires() for now...");
	return 0;
}

function luaNull() {
	console.warn("called null:");
	let args = [];
	while(lua.lua_gettop(L) > 0) {
		args.unshift(luaValToObj());
		lua.lua_pop(L, 1);
	}
	console.warn.apply(null, args);
	return 0;
}

function luaTry(f) {
	let start = lua.lua_gettop(L);
	f();
	while (start < lua.lua_gettop(L)) {
		console.warn("stack: ",lua.lua_tojsstring(L,-1));
		lua.lua_pop(L, 1);
	}
}

//initLua();
//luaPrint("HALO WORLD")
//lauxlib.luaL_dostring(L, luaString('print("printing test successful, with arguments!:",42, {["asd"]="qwe",["zxc"]=123})'));
//lauxlib.luaL_dostring(L, luaString('testX("overload1 successful")'));
//luaTry(()=>lauxlib.luaL_dostring(L, luaString('print(Tracker)')));
//luaTry(()=>lauxlib.luaL_dostring(L, luaString('print(Tracker.FindObjectForCode)')));
//luaTry(()=>lauxlib.luaL_dostring(L, luaString('print(Tracker.FindObjectForCodex.y)')));
//luaTry(()=>lauxlib.luaL_dostring(L, luaString('Tracker:FindObjectForCode("overload2 successful")')));

