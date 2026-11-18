import {useState,useSyncExternalStore} from "react";
import {preferences,togglePin,ItemRef} from "./preferences";
export function PinButton({item}:{item:ItemRef}){const {value:p}=useSyncExternalStore(preferences.subscribe,preferences.snapshot),[message,setMessage]=useState("");const pinned=p.pins.some(r=>r.kind===item.kind&&r.id===item.id);return <><button aria-pressed={pinned} onClick={()=>{try{togglePin(item);setMessage("");}catch(e){setMessage((e as Error).message);}}}>{pinned?"Unpin":"Pin to Home"}</button>{message&&<span role="status">{message}</span>}</>;}
