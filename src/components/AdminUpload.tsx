import React, { useState } from "react";

export const AdminUpload: React.FC = () => {
  const [title, setTitle] = useState(``);
  const [price, setPrice] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!file) return alert(`Select a file!`);

    try {
      // 1. Request signed URL from Worker
      const sessionRes = await fetch(`/api/admin/upload-intent`, {
        method: `POST`,
        headers: {
          "Content-Type": `application/json`,
          "Authorization": `Bearer ${localStorage.getItem(`jwt`)}`
        },
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      });
      const { uploadUrl, objectKey } = await sessionRes.json();

      // 2. Upload directly to R2
      const uploadRes = await fetch(uploadUrl, {
        method: `PUT`,
        headers: { "Content-Type": file.type },
        body: file
      });
      if (!uploadRes.ok) throw new Error(`Upload failed`);

      // 3. Finalize metadata in Worker
      await fetch(`/api/admin/finalize-product`, {
        method: `POST`,
        headers: { Authorization: `Bearer ${localStorage.getItem(`jwt`)}` },
        body: JSON.stringify({ title, price, imageKey: objectKey })
      });

      alert(`Upload complete!`);
    } catch (err) {
      console.error(err);
      alert(`Upload failed`);
    }
  };

  return (
    <div>
      <h2>Admin Upload</h2>
      <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
      <input type="number" placeholder="Price (cents)" value={price} onChange={e => setPrice(Number(e.target.value))} />
      <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
      <button onClick={handleUpload}>Upload</button>
    </div>
  );
};
