export async function resizeImage(file) {
  if (!(file instanceof Blob) || !file.type.startsWith('image/')) {
    throw new Error('Sélectionne un fichier image.');
  }

  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / image.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de préparer cette image.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Impossible de convertir l’image au format WebP.'));
    }, 'image/webp', 0.85);
  });
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
}
