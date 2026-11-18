import {useEffect,useState} from "react";
export function NumberInput({value,min,max,onChange,label,disabled=false,step=.1}:{value:number;min:number;max:number;onChange:(n:number)=>void;label:string;disabled?:boolean;step?:number}){
 const [text,setText]=useState(String(value));useEffect(()=>setText(String(value)),[value]);return <input aria-label={label} type="number" inputMode="decimal" min={min} max={max} step={step} disabled={disabled} value={text} onChange={e=>{setText(e.target.value);const n=e.target.valueAsNumber;if(Number.isFinite(n)&&n>=min&&n<=max)onChange(n);}} onBlur={()=>setText(String(value))}/>;
}
