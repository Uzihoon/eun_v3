import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpFromLine, File, X, ArrowUpRight, Dna, AlertCircle, LoaderCircle } from 'lucide-react';
export function Logo({ light = false }: { light?: boolean }) {
  return <a href="#/analysis" className={`logo ${light ? 'light' : ''}`} aria-label="EUN home"><span className="logo-symbol"><Dna size={24}/></span><span>eun<span className="logo-period">.</span></span></a>;
}
export function PageHeading({ section, title, description, actions }: { section: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="page-heading"><div className="breadcrumb">Workspace <span>/</span> {section}</div><div className="heading-row"><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="actions">{actions}</div>}</div></header>;
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}><AlertCircle size={18}/><div>{children}</div></div>;
}
export function Spinner() { return <LoaderCircle className="spin" size={18} aria-hidden="true"/>; }
export function Field({ label, hint, children, optional = false }: { label: string; hint?: string; children: (id: string) => ReactNode; optional?: boolean }) {
  const id = useId();
  return <div className="field"><label htmlFor={id}>{label}{optional && <span className="optional">Optional</span>}</label>{children(id)}{hint && <p className="field-hint">{hint}</p>}</div>;
}
export function Dropzone({ files, onChange, accept = '.json', label = 'Choose JSON reports', detail = 'or drag and drop them here', multiple = true, disabled = false }: { files: File[]; onChange: (f: File[]) => void; accept?: string; label?: string; detail?: string; multiple?: boolean; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const add = (incoming: File[]) => {
    if (disabled) return;
    const unique = new Map((multiple ? [...files, ...incoming] : incoming.slice(0, 1)).map(f => [f.name, f]));
    onChange([...unique.values()]);
  };
  return <div className="upload-group"><button type="button" className="dropzone" disabled={disabled} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); if (!disabled) e.currentTarget.classList.add('dragover'); }} onDragLeave={e => e.currentTarget.classList.remove('dragover')} onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); add(Array.from(e.dataTransfer.files)); }} aria-controls={id}>
    <ArrowUpFromLine size={25} strokeWidth={1.5}/><strong>{label}</strong><span>{detail}</span><span className="browse-label">Browse files <ArrowUpRight size={14}/></span>
  </button><input ref={input} id={id} className="sr-only" tabIndex={-1} type="file" accept={accept} multiple={multiple} disabled={disabled} aria-label={label} onChange={e => { add(Array.from(e.target.files ?? [])); e.target.value = ''; }}/>
  {files.length > 0 && <div className="file-list"><div className="file-list-label">{files.length} file{files.length === 1 ? '' : 's'} selected <button className="text-button" type="button" disabled={disabled} onClick={() => onChange([])}>Clear all</button></div>{files.map(f => <div className="file-row" key={f.name}><File size={17}/><span>{f.name}</span><small>{(f.size / 1024 / 1024).toFixed(2)} MB</small><button className="icon-button" aria-label={`Remove ${f.name}`} disabled={disabled} type="button" onClick={() => onChange(files.filter(x => x !== f))}><X size={15}/></button></div>)}</div>}
  </div>;
}
