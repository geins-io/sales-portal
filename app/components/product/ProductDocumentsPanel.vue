<script setup lang="ts">
import {
  ExternalLink,
  FileArchive,
  FileAudio,
  FileAxis3d,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideoCamera,
  Play,
} from 'lucide-vue-next';
import type {
  ProductMediaFileType,
  ProductMediaParameter,
} from '#shared/constants/product-media';

/**
 * The documents tab's body: a product's media parameters, already split into
 * videos and downloadable documents by classifyProductMedia.
 */
const props = defineProps<{
  videos: ProductMediaParameter[];
  documents: ProductMediaParameter[];
}>();

/**
 * The icon set carries no brand marks, so `pdf` and `text` share one —
 * these are format families, not exact formats.
 */
const DOCUMENT_ICONS = {
  pdf: FileText,
  text: FileText,
  spreadsheet: FileSpreadsheet,
  archive: FileArchive,
  image: FileImage,
  video: FileVideoCamera,
  audio: FileAudio,
  cad: FileAxis3d,
  code: FileCode,
} as const;

/**
 * A null fileType means the URL has no file extension to go on, so it opens a
 * page rather than downloading something — worth showing differently so a
 * shopper knows what a click will do.
 */
function documentIcon(fileType: ProductMediaFileType | null) {
  return fileType ? DOCUMENT_ICONS[fileType] : ExternalLink;
}

/**
 * Host shown as the text of an external video link, so a shopper can see
 * where the link goes before following it. Falls back to the raw URL for a
 * value too malformed to parse — it passed the `https://` prefix check but
 * that does not make it a complete URL.
 */
function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const videoItems = computed(() => props.videos);
const documentItems = computed(() => props.documents);
</script>
<template>
  <h3 class="font-heading mb-4 text-2xl font-bold">
    {{ $t('product.documents') }}
  </h3>
  <div class="flex flex-col gap-8">
    <div
      v-if="videoItems.length"
      class="grid gap-6 sm:grid-cols-2"
      data-testid="product-videos"
    >
      <div
        v-for="(video, idx) in videoItems"
        :key="`${video.url}:${idx}`"
        class="flex flex-col gap-2"
      >
        <p class="text-sm font-medium">
          {{ video.label }}
          <small
            v-if="video.fileName"
            class="text-muted-foreground ml-1 font-normal"
          >
            {{ video.fileName }}
          </small>
        </p>
        <div
          class="border-border aspect-video w-full overflow-hidden rounded-lg border"
        >
          <!-- embedUrl is non-null exactly when display is 'embed';
               keying the branch off it keeps the src type-safe. -->
          <iframe
            v-if="video.embedUrl"
            :src="video.embedUrl"
            class="h-full w-full"
            frameborder="0"
            allowfullscreen
            allow="autoplay; encrypted-media"
            :title="video.label"
          />
          <video
            v-else-if="video.display === 'file'"
            :src="video.url"
            controls
            class="h-full w-full"
          />
          <!-- Neither embeddable nor a playable file: a <video> here
               would render controls that can never play anything, so
               link out instead and name the host being opened. -->
          <a
            v-else
            :href="video.url"
            target="_blank"
            rel="noopener"
            class="hover:bg-muted/40 flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-sm transition-colors"
          >
            <Play class="text-muted-foreground h-6 w-6" />
            <span class="underline">{{ linkHost(video.url) }}</span>
          </a>
        </div>
      </div>
    </div>
    <div
      v-if="documentItems.length"
      class="grid gap-3 sm:grid-cols-2"
      data-testid="product-documents"
    >
      <a
        v-for="(doc, idx) in documentItems"
        :key="`${doc.url}:${idx}`"
        :href="doc.url"
        target="_blank"
        rel="noopener"
        class="border-border hover:bg-muted/40 flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors"
      >
        <component
          :is="documentIcon(doc.fileType)"
          class="text-muted-foreground h-5 w-5 shrink-0"
        />
        <span class="min-w-0 truncate">
          {{ doc.label }}
          <small
            v-if="doc.fileName"
            class="text-muted-foreground ml-1 font-normal"
          >
            {{ doc.fileName }}
          </small>
        </span>
      </a>
    </div>
  </div>
</template>
