<script setup lang="ts">
/**
 * The product's files as one list, in the order they come. Each row says what
 * the file is: type and size. A file the browser can show (PDF, images) has
 * "View", which opens it in a new tab (the name is a shortcut to the same);
 * every file has "Download".
 */
import { Download, Eye, FileAudio, FileImage, FileText } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import {
  documentDownloadUrl,
  documentIconKind,
  formatDocumentSize,
  isViewableDocument,
  safeDocumentUrl,
  type ProductDocument,
} from '~/utils/product-documents';

defineProps<{ documents: ProductDocument[] }>();

const { t, locale } = useI18n();

const ICONS = { image: FileImage, audio: FileAudio, text: FileText };

function meta(doc: ProductDocument): string {
  return [
    doc.fileType.toUpperCase(),
    formatDocumentSize(doc.sizeBytes, locale.value),
  ]
    .filter(Boolean)
    .join(' · ');
}
</script>

<template>
  <div data-testid="product-documents">
    <ul class="divide-border border-border divide-y rounded-lg border">
      <li
        v-for="doc in documents"
        :key="doc.id"
        class="flex items-center gap-4 px-4 py-3"
        data-testid="product-document"
      >
        <div
          class="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md"
        >
          <component
            :is="ICONS[documentIconKind(doc.fileType)]"
            class="text-muted-foreground size-5"
          />
        </div>
        <div class="min-w-0 flex-1">
          <a
            v-if="safeDocumentUrl(doc.url) && isViewableDocument(doc.fileType)"
            :href="safeDocumentUrl(doc.url)!"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-primary block truncate text-sm font-medium underline-offset-4 hover:underline"
            :title="t('product.document_open', { name: doc.name })"
            data-testid="product-document-open"
          >
            {{ doc.name }}
          </a>
          <p
            v-else
            class="truncate text-sm font-medium"
            data-testid="product-document-name"
          >
            {{ doc.name }}
          </p>
          <p
            class="text-muted-foreground text-xs"
            data-testid="product-document-meta"
          >
            {{ meta(doc) }}
          </p>
        </div>
        <Button
          v-if="safeDocumentUrl(doc.url) && isViewableDocument(doc.fileType)"
          as-child
          variant="outline"
          size="sm"
          class="shrink-0 shadow-none"
        >
          <a
            :href="safeDocumentUrl(doc.url)!"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t('product.document_open', { name: doc.name })"
            data-testid="product-document-view"
          >
            <Eye class="size-4" />
            <span class="hidden sm:inline">{{
              t('product.document_view')
            }}</span>
          </a>
        </Button>
        <!-- `download=1` makes the CDN answer as an attachment under the
             file's own name; a `download` attribute alone is ignored
             cross-origin. -->
        <Button
          v-if="safeDocumentUrl(doc.url)"
          as-child
          variant="outline"
          size="sm"
          class="shrink-0 shadow-none"
        >
          <a
            :href="documentDownloadUrl(safeDocumentUrl(doc.url)!)"
            :download="doc.fileName"
            :aria-label="
              t('product.document_download_named', { name: doc.name })
            "
            data-testid="product-document-download"
          >
            <Download class="size-4" />
            <span class="hidden sm:inline">{{
              t('product.document_download')
            }}</span>
          </a>
        </Button>
      </li>
    </ul>
  </div>
</template>
