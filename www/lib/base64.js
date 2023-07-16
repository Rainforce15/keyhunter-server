function bytesToBase64(b){
	let r='',i,l=b.length,abc="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	for (i=2;i<l;i+=3){
		r+=abc[b[i-2]>>2];
		r+=abc[((b[i-2]&0x03)<<4)|(b[i-1]>>4)];
		r+=abc[((b[i-1]&0x0F)<<2)|(b[i]>>6)];
		r+=abc[b[i]&0x3F];
	}
	if (i === l+1){
		r+=abc[b[i-2]>>2];
		r+=abc[(b[i-2]&0x03)<<4];
		r+="==";
	}
	if (i === l){
		r+=abc[b[i-2]>>2];
		r+=abc[((b[i-2]&0x03)<<4)|(b[i-1]>>4)];
		r+=abc[(b[i-1]&0x0F)<<2];
		r+="=";
	}
	return r;
}
