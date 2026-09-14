import { useCancelMediaUpload, useCompleteMediaUpload, useRequestMediaUploadUrl } from '@workspace/api-client-react';
import type { MediaAttachment } from '@workspace/api-client-react';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '@clerk/clerk-expo';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type MediaPickerMode = 'image' | 'video' | 'both';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp', 'video/mpeg', 'video/ogg']);

export function toAbsoluteMediaUrl(url?: string | null) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}${url.startsWith('/') ? url : `/${url}`}` : url;
}

function labelForMode(mode: MediaPickerMode) {
  if (mode === 'image') return 'Dodaj zdjęcie';
  if (mode === 'video') return 'Dodaj film';
  return 'Dodaj zdjęcie lub film';
}

function extensionFor(uri: string, mediaType: 'image' | 'video') {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension && /^[a-z0-9]{2,5}$/.test(extension)) return extension;
  return mediaType === 'video' ? 'mp4' : 'jpg';
}

function contentTypeFor(asset: ImagePicker.ImagePickerAsset, mediaType: 'image' | 'video') {
  const candidate = asset.mimeType?.toLowerCase();
  if (candidate && (IMAGE_TYPES.has(candidate) || VIDEO_TYPES.has(candidate))) return candidate;
  const extension = extensionFor(asset.fileName ?? asset.uri, mediaType);
  if (mediaType === 'video') {
    return extension === 'webm' ? 'video/webm' : extension === 'mov' ? 'video/quicktime' : 'video/mp4';
  }
  if (extension === 'png') return 'image/png';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function localFileSize(uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob.size;
}

async function putFile(uri: string, uploadURL: string, contentType: string, onProgress: (value: number) => void) {
  const blob = await (await fetch(uri)).blob();
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadURL);
    request.setRequestHeader('Content-Type', contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error(`Upload zakończył się błędem (${request.status}).`));
    request.onerror = () => reject(new Error('Nie udało się przesłać pliku. Sprawdź połączenie.'));
    request.ontimeout = () => reject(new Error('Przesyłanie pliku trwało zbyt długo.'));
    request.send(blob);
  });
}

export function MediaPickerUpload({
  mode = 'both',
  value,
  onChange,
  compact = false,
  claimedAttachmentId,
}: {
  mode?: MediaPickerMode;
  value?: MediaAttachment | null;
  onChange: (attachment: MediaAttachment | null) => void;
  compact?: boolean;
  /** Set once the parent has persisted this attachment on its content. */
  claimedAttachmentId?: string | null;
}) {
  const colors = useColors();
  const requestUpload = useRequestMediaUploadUrl();
  const completeUpload = useCompleteMediaUpload();
  const cancelUpload = useCancelMediaUpload();
  const [previewUri, setPreviewUri] = useState('');
  const [previewType, setPreviewType] = useState<'image' | 'video' | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Only IDs created by this picker are safe to cancel. An attachment passed
  // in by a parent may already be claimed by a post, profile, comment, etc.
  const unclaimedAttachmentId = useRef<string | null>(null);

  useEffect(() => {
    // A parent clearing/replacing the value is the signal that it claimed or
    // otherwise took ownership of the upload. Never cancel that attachment.
    if (unclaimedAttachmentId.current && value?.id !== unclaimedAttachmentId.current) {
      unclaimedAttachmentId.current = null;
    }
  }, [value?.id]);

  useEffect(() => {
    if (claimedAttachmentId && unclaimedAttachmentId.current === claimedAttachmentId) {
      unclaimedAttachmentId.current = null;
    }
  }, [claimedAttachmentId]);

  const cancelUnclaimed = async (attachmentId: string | null) => {
    if (!attachmentId || unclaimedAttachmentId.current !== attachmentId || value?.id !== attachmentId) return;
    await cancelUpload.mutateAsync({ attachmentId });
    unclaimedAttachmentId.current = null;
  };

  const pick = async () => {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Zezwól na dostęp do zdjęć i filmów, aby dodać załącznik.');
      return;
    }
    const mediaTypes: ImagePicker.MediaType[] = mode === 'image' ? ['images'] : mode === 'video' ? ['videos'] : ['images', 'videos'];
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing: mode === 'image',
      quality: 0.9,
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const mediaType = asset.type === 'video' ? 'video' : 'image';
    if ((mode === 'image' && mediaType !== 'image') || (mode === 'video' && mediaType !== 'video')) {
      setError(mode === 'image' ? 'Wybierz plik graficzny.' : 'Wybierz plik wideo.');
      return;
    }
    const contentType = contentTypeFor(asset, mediaType);
    const maxBytes = mediaType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (!(mediaType === 'video' ? VIDEO_TYPES : IMAGE_TYPES).has(contentType)) {
      setError(`Ten typ pliku nie jest obsługiwany. ${mediaType === 'video' ? 'Użyj MP4, WebM lub MOV.' : 'Użyj JPG, PNG, GIF, WebP lub HEIC.'}`);
      return;
    }
    const size = asset.fileSize ?? await localFileSize(asset.uri);
    if (size > maxBytes) {
      setError(mediaType === 'video' ? 'Film jest za duży. Maksymalny rozmiar to 100 MB.' : 'Zdjęcie jest za duże. Maksymalny rozmiar to 10 MB.');
      return;
    }

    if (unclaimedAttachmentId.current) {
      try {
        await cancelUnclaimed(unclaimedAttachmentId.current);
      } catch {
        setError('Nie udało się zastąpić poprzedniego załącznika. Spróbuj ponownie.');
        return;
      }
    }
    setPreviewUri(asset.uri);
    setPreviewType(mediaType);
    setBusy(true);
    setProgress(0);
    try {
      const response = await requestUpload.mutateAsync({
        data: {
          name: asset.fileName || `zyvio-${Date.now()}.${extensionFor(asset.uri, mediaType)}`,
          size,
          contentType,
        },
      });
      // Keep the pending ID too: if the direct PUT or completion fails, the
      // server-side pending record can still be cleaned up.
      unclaimedAttachmentId.current = response.attachmentId;
      await putFile(asset.uri, response.uploadURL, contentType, setProgress);
      const attachment = await completeUpload.mutateAsync({ data: { attachmentId: response.attachmentId } });
      unclaimedAttachmentId.current = attachment.id;
      onChange(attachment);
      setProgress(100);
    } catch (uploadError) {
      const pendingId = unclaimedAttachmentId.current;
      if (pendingId) {
        try {
          await cancelUpload.mutateAsync({ attachmentId: pendingId });
        } catch {
          // Preserve the original upload error; the API may already have
          // cleaned up a failed/pending upload.
        }
        unclaimedAttachmentId.current = null;
      }
      setError(uploadError instanceof Error ? uploadError.message : 'Nie udało się przesłać pliku.');
      onChange(null);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const attachmentId = unclaimedAttachmentId.current;
    setPreviewUri('');
    setPreviewType(null);
    setProgress(0);
    setError('');
    onChange(null);
    if (attachmentId) {
      try {
        // Call before the parent can claim this ID; existing/claimed values
        // are excluded by the ref + controlled value checks above.
        await cancelUnclaimed(attachmentId);
      } catch {
        setError('Nie udało się usunąć załącznika z serwera. Spróbuj ponownie.');
      }
    }
  };

  const displayUri = previewUri || value?.url;
  const displayType = previewType || value?.mediaType;
  return (
    <View style={styles.wrapper}>
      {displayUri ? (
        <View style={styles.previewFrame}>
          <MediaAttachmentView attachment={value && !previewUri ? value : { id: 'local', url: displayUri, mediaType: displayType === 'video' ? 'video' : 'image', contentType: '', size: 0, originalName: '' }} />
          <Pressable accessibilityLabel="Usuń załącznik" testID="remove-media" onPress={remove} style={[styles.remove, { backgroundColor: colors.background }]}>
            <Ionicons name="close" size={16} color={colors.foreground} />
          </Pressable>
          {busy ? (
            <View style={[styles.progress, { backgroundColor: `${colors.background}dd` }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Przesyłanie {progress}%</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={labelForMode(mode)}
        testID={`add-media-${mode}`}
        onPress={pick}
        disabled={busy}
        style={({ pressed }) => [styles.picker, { borderColor: colors.border, backgroundColor: colors.input, opacity: busy ? 0.55 : pressed ? 0.75 : 1 }, compact && styles.pickerCompact]}
      >
        <Ionicons name={mode === 'image' ? 'image-outline' : mode === 'video' ? 'videocam-outline' : 'images-outline'} size={18} color={colors.primary} />
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{labelForMode(mode)}</Text>
      </Pressable>
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

function VideoAttachment({ uri, token }: { uri: string; token: string | null }) {
  const colors = useColors();
  const player = useVideoPlayer({ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined }, (instance) => {
    instance.loop = false;
  });
  return (
    <View style={[styles.videoFrame, { backgroundColor: colors.background }]}>
      <VideoView player={player} style={styles.media} nativeControls contentFit="contain" />
    </View>
  );
}

export function MediaAttachmentView({ attachment }: { attachment: MediaAttachment }) {
  const colors = useColors();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const uri = toAbsoluteMediaUrl(attachment.url);
  useEffect(() => {
    let active = true;
    void getToken().then((next) => { if (active) setToken(next); });
    return () => { active = false; };
  }, [getToken]);
  if (!uri) return null;
  if (failed) {
    return (
      <View style={[styles.mediaFallback, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Ionicons name={attachment.mediaType === 'video' ? 'videocam-off-outline' : 'image-outline'} size={26} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Nie udało się załadować pliku</Text>
        <Pressable onPress={() => setFailed(false)} accessibilityRole="button">
          <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 12 }}>Spróbuj ponownie</Text>
        </Pressable>
      </View>
    );
  }
  if (attachment.mediaType === 'video') return <VideoAttachment uri={uri} token={token} />;
  return (
    <Image
      accessibilityLabel={attachment.originalName || 'Załączone zdjęcie'}
      source={{ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
      contentFit="cover"
      style={[styles.media, { backgroundColor: colors.background }]}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  previewFrame: { minHeight: 130, overflow: 'hidden', borderRadius: 14, position: 'relative' },
  media: { width: '100%', height: 210 },
  videoFrame: { width: '100%', height: 210, borderRadius: 14, overflow: 'hidden' },
  mediaFallback: { minHeight: 130, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 16 },
  remove: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  progress: { position: 'absolute', left: 8, right: 8, bottom: 8, minHeight: 38, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  picker: { minHeight: 42, borderWidth: 1, borderRadius: 12, borderStyle: 'dashed', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pickerCompact: { alignSelf: 'flex-start', paddingHorizontal: 10 },
  error: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold' },
});