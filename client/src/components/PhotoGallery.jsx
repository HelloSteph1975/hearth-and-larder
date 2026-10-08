import { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { resizeImage } from '../lib/image.js';
import { useDeleteWithUndo } from './useDeleteWithUndo.jsx';
import { useToast } from './ToastProvider.jsx';

export async function uploadPhoto(ownerType, ownerId, file, caption = '') {
  const blob = await resizeImage(file);
  const fd = new FormData();
  fd.append('owner_type', ownerType);
  fd.append('owner_id', String(ownerId));
  fd.append('caption', caption);
  fd.append('file', blob, 'photo.jpg');
  return api.upload('/api/photos', fd);
}

export function PhotoGallery({ ownerType, ownerId, photos, onChange }) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const del = useDeleteWithUndo();
  const toast = useToast();
  async function add(files) {
    setBusy(true);
    try { for (const f of files) if (f.type.startsWith('image/')) await uploadPhoto(ownerType, ownerId, f); }
    catch (err) { toast.show({ message: err.message, duration: 6000 }); }
    finally { setBusy(false); onChange(); }
  }
  async function caption(p, text) {
    if (text === (p.caption ?? '')) return;
    try {
      await api.patch(`/api/photos/${p.id}`, { caption: text });
      onChange();
    } catch (err) {
      toast.show({ message: err.message, duration: 6000 });
    }
  }
  return (
    <div className="gallery">
      {photos.map(p => (
        <figure key={p.id} className="gallery-item">
          <img src={`/photos/${p.filename}`} alt={p.caption || 'Photo'} loading="lazy" />
          <figcaption>
            <input className="caption-input" defaultValue={p.caption ?? ''} placeholder="Add a caption" aria-label="Photo caption"
              onBlur={e => caption(p, e.target.value)} />
            <button className="icon-btn" aria-label="Delete photo" onClick={() => del({ url: `/api/photos/${p.id}`, label: 'photo', onChange })}>
              <Trash2 size={16} />
            </button>
          </figcaption>
        </figure>
      ))}
      <label className={`gallery-drop ${over ? 'is-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); add([...e.dataTransfer.files]); }}>
        <ImagePlus size={28} aria-hidden />
        <span>{busy ? 'Adding…' : 'Drop photos here or click to choose'}</span>
        <input type="file" accept="image/*" multiple className="visually-hidden"
          onChange={e => { const files = [...e.target.files]; e.target.value = ''; add(files); }} />
      </label>
    </div>
  );
}
