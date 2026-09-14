import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { CheckCircle2, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import {
  useCompleteMediaUpload,
  useCancelMediaUpload,
  useRequestMediaUploadUrl,
} from "@workspace/api-client-react";
import type { MediaAttachment } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/heic", "image/heif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/3gpp", "video/mpeg", "video/ogg"]);

export type MediaPickerHandle = {
  getAttachment: () => MediaAttachment | null;
  isUploading: () => boolean;
};

type MediaPickerProps = {
  label?: string;
  imageOnly?: boolean;
  onChange?: (attachment: MediaAttachment | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  /** Set this once the parent has successfully claimed the attachment. */
  claimedAttachmentId?: string | null;
  disabled?: boolean;
  className?: string;
};

function mediaError(file: File, imageOnly: boolean) {
  const type = file.type.toLowerCase();
  if (!IMAGE_TYPES.has(type) && (!VIDEO_TYPES.has(type) || imageOnly)) {
    return imageOnly
      ? "Wybierz zdjęcie w formacie JPG, PNG, GIF, WEBP lub HEIC."
      : "Wybierz zdjęcie albo film w obsługiwanym formacie.";
  }
  const max = VIDEO_TYPES.has(type) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > max) {
    return VIDEO_TYPES.has(type)
      ? "Film jest za duży. Maksymalny rozmiar to 100 MB."
      : "Zdjęcie jest za duże. Maksymalny rozmiar to 10 MB.";
  }
  return null;
}

function uploadBytes(url: string, file: File, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Upload zakończył się błędem (${request.status}).`));
    };
    request.onerror = () => reject(new Error("Nie udało się przesłać pliku. Sprawdź połączenie i spróbuj ponownie."));
    request.onabort = () => reject(new Error("Przesyłanie pliku zostało przerwane."));
    request.send(file);
  });
}

export const MediaPicker = forwardRef<MediaPickerHandle, MediaPickerProps>(function MediaPicker({
  label = "➕ Dodaj zdjęcie lub film",
  imageOnly = false,
  onChange,
  onUploadingChange,
  claimedAttachmentId = null,
  disabled = false,
  className = "",
}, ref) {
  const requestUpload = useRequestMediaUploadUrl();
  const completeUpload = useCompleteMediaUpload();
  const cancelUpload = useCancelMediaUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const serverAttachmentId = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<MediaAttachment | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  useImperativeHandle(ref, () => ({
    getAttachment: () => attachment,
    isUploading: () => uploading,
  }), [attachment, uploading]);

  const cancelIfUnclaimed = async (attachmentId: string | null | undefined) => {
    if (!attachmentId || attachmentId === claimedAttachmentId) return;
    try {
      await cancelUpload.mutateAsync({ attachmentId });
    } catch {
      // The selection is still removed locally. A failed cleanup must not
      // strand the user in the picker or block a replacement upload.
    }
  };

  const clear = () => {
    const previousAttachmentId = serverAttachmentId.current ?? attachment?.id;
    serverAttachmentId.current = null;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setFile(null);
    setPreview(null);
    setAttachment(null);
    setProgress(0);
    setUploading(false);
    onUploadingChange?.(false);
    setError(null);
    onChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
    void cancelIfUnclaimed(previousAttachmentId);
  };

  const choose = async (nextFile: File | undefined) => {
    if (!nextFile) return;
    const validationError = mediaError(nextFile, imageOnly);
    if (validationError) {
      clear();
      setError(validationError);
      return;
    }
    const previousAttachmentId = serverAttachmentId.current ?? attachment?.id;
    serverAttachmentId.current = null;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const localPreview = URL.createObjectURL(nextFile);
    previewRef.current = localPreview;
    setFile(nextFile);
    setPreview(localPreview);
    setAttachment(null);
    setError(null);
    setProgress(0);
    setUploading(true);
    onUploadingChange?.(true);
    onChange?.(null);
    try {
      if (previousAttachmentId && previousAttachmentId !== claimedAttachmentId) {
        await cancelIfUnclaimed(previousAttachmentId);
      }
      const requested = await requestUpload.mutateAsync({
        data: { name: nextFile.name, size: nextFile.size, contentType: nextFile.type },
      });
      serverAttachmentId.current = requested.attachmentId;
      await uploadBytes(requested.uploadURL, nextFile, setProgress);
      const uploaded = await completeUpload.mutateAsync({ data: { attachmentId: requested.attachmentId } });
      setAttachment(uploaded);
      setProgress(100);
      onChange?.(uploaded);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Nie udało się przesłać pliku.";
      setError(message.includes("HTTP") ? `Nie udało się przesłać pliku. ${message}` : message);
      setAttachment(null);
      onChange?.(null);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  const accept = imageOnly ? "image/jpeg,image/png,image/gif,image/webp,image/avif,image/heic,image/heif" : "image/*,video/*";
  return (
    <div className={`media-picker ${className}`}>
      {!file && (
        <button
          type="button"
          className="media-picker-trigger"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          aria-label={label}
        >
          <ImagePlus aria-hidden="true" />
          <span>{label}</span>
        </button>
      )}
      <input ref={inputRef} className="media-picker-input" type="file" accept={accept} onChange={(event) => void choose(event.target.files?.[0])} disabled={disabled || uploading} />
      {file && preview && (
        <div className="media-picker-preview">
          {file.type.startsWith("video/") ? (
            <video src={preview} controls muted playsInline preload="metadata" aria-label={`Podgląd filmu ${file.name}`} />
          ) : (
            <img src={preview} alt={`Podgląd zdjęcia ${file.name}`} />
          )}
          <div className="media-picker-info">
            <strong>{file.name}</strong>
            <span>{uploading ? `Przesyłanie: ${progress}%` : attachment ? "Plik gotowy do wysłania" : "Nie przesłano"}</span>
            {uploading && <div className="media-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}
            {attachment && !uploading && <CheckCircle2 className="media-ready-icon" aria-label="Plik gotowy" />}
          </div>
          <button type="button" className="media-picker-remove" onClick={clear} disabled={uploading || disabled} aria-label="Usuń wybrany plik"><Trash2 /></button>
          {uploading && <Loader2 className="media-picker-spinner spin" aria-label="Przesyłanie pliku" />}
        </div>
      )}
      {error && <p className="media-picker-error" role="alert">{error}</p>}
      {file && !uploading && (
        <Button type="button" variant="ghost" size="sm" className="media-picker-change" onClick={() => inputRef.current?.click()} disabled={disabled}>
          <Upload /> Zmień plik
        </Button>
      )}
    </div>
  );
});

type MediaValue = Pick<MediaAttachment, "url" | "mediaType" | "contentType" | "originalName">;

export function MediaRenderer({
  attachments = [],
  mediaUrl,
  mediaType,
  label = "Załącznik multimedialny",
}: {
  attachments?: MediaAttachment[];
  mediaUrl?: string | null;
  mediaType?: string | null;
  label?: string;
}) {
  const values: MediaValue[] = attachments.length
    ? attachments
    : mediaUrl
      ? [{ url: mediaUrl, mediaType: mediaType === "video" ? "video" : "image", contentType: mediaType === "video" ? "video/mp4" : "image/*", originalName: label }]
      : [];
  if (!values.length) return null;
  return (
    <div className="media-renderer" aria-label={label}>
      {values.map((item, index) => item.mediaType === "video" ? (
        <video key={`${item.url}-${index}`} controls playsInline preload="metadata" aria-label={`${label}: film ${item.originalName}`} className="media-renderer-video">
          <source src={item.url} type={item.contentType} />
          Twoja przeglądarka nie obsługuje odtwarzania filmu.
        </video>
      ) : (
        <img key={`${item.url}-${index}`} src={item.url} alt={`${label}: ${item.originalName}`} className="media-renderer-image" loading="lazy" />
      ))}
    </div>
  );
}