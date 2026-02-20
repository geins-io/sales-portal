export type {
  ContentPageType,
  ContentAreaType,
  ContentContainerType,
  ContentType,
  ContentConfigType,
  ContentMetaType,
} from '@geins/types';

export interface WidgetImage {
  /** CMS configuration uses lowercase `filename` */
  filename: string;
  /** GraphQL images use camelCase `fileName` */
  fileName?: string;
  href?: string;
  altText?: string;
  text?: string | null;
  title?: string | null;
  filenameForMobileDevice?: string | null;
  largestSize?: { imageWidth: number; imageHeight: number; imageRatio: number };
}

export interface TextWidgetData {
  name: string;
  active: boolean;
  text: string;
  /** 1=left, 2=center, 3=right, 4=justify, 0=none. ralph-ui: CaWidgetText.vue */
  textAlignment?: number;
  /** 0=h1, 1=h2, 2=h3, 3=div. ralph-ui: CaWidgetText.vue getHeadingTag() */
  titleRenderMode?: number;
  /** Explicit title text from CMS (preferred over config.displayName) */
  title?: string;
  subtitle?: string;
  subtitleRenderMode?: string | number;
  classNames?: string;
}

export interface HtmlWidgetData {
  name: string;
  active: boolean;
  html: string;
  css?: string;
}

export interface ImageWidgetData {
  name: string;
  active: boolean;
  image: WidgetImage;
}

export interface BannerWidgetData {
  name: string;
  active: boolean;
  image: WidgetImage;
  text1?: string;
  text2?: string;
  buttonText?: string;
  /** Non-fullwidth: 0=below-image, 1=on-image. ralph-ui: CaWidgetBanner.vue */
  textAndButtonPlacement?: number;
  /** Full-width: 0=left, 1=middle, 2=right. ralph-ui: CaWidgetBanner.vue */
  textAndButtonPlacementFullWidth?: number;
  /** 0=primary color, 1=secondary color. ralph-ui: CaWidgetBanner.vue textColor() */
  textColor?: number;
  classNames?: string;
}

export interface ButtonItem {
  text: string;
  href: string;
}

export interface ButtonsWidgetData {
  name: string;
  active: boolean;
  buttons: ButtonItem[];
}

export type WidgetData =
  | TextWidgetData
  | HtmlWidgetData
  | ImageWidgetData
  | BannerWidgetData
  | ButtonsWidgetData;

/** Resolve the image filename from either `filename` (CMS config) or `fileName` (GraphQL). */
export function resolveImageFileName(image: WidgetImage | undefined): string {
  if (!image) return '';
  return image.filename || image.fileName || '';
}
