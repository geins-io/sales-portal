export type {
  ContentPageType,
  ContentPageAreaType,
  ContentAreaType,
  ContentContainerType,
  ContentType,
  ContentConfigType,
  ContentMetaType,
  MenuType,
  MenuItemType,
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
  /** 1=left, 2=center, 3=right, 4=justify, 0=none */
  textAlignment?: number;
  /** 0=h1, 1=h2, 2=h3, 3=div */
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
  /** Non-fullwidth: 0=below-image, 1=on-image */
  textAndButtonPlacement?: number;
  /** Full-width: 0=left, 1=middle, 2=right */
  textAndButtonPlacementFullWidth?: number;
  /** 0=primary color, 1=secondary color */
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

export interface VideoWidgetData {
  name: string;
  active: boolean;
  /** Video ID (YouTube or Vimeo) */
  videoId: string;
  /** 0=youtube, 1=vimeo */
  videoProvider?: number;
  /** Optional thumbnail image */
  image?: WidgetImage;
}

export type FormFieldType = 'input' | 'email' | 'textarea' | 'select';

export interface FormWidgetField {
  label: string;
  name: string;
  required: boolean;
  type: FormFieldType;
  options?: { value: string; label: string }[];
}

export interface FormWidgetData {
  sendFormToEmail: string;
  fields: FormWidgetField[];
  /**
   * Email subject for the mailto. Supports `{fieldName}` placeholders that are
   * filled from the submitted values (e.g. `Account application: {company}`).
   * When unset, falls back to `templateName`, then a neutral default.
   */
  subject?: string;
  /** Submit button label. Falls back to a neutral translated default. */
  submitLabel?: string;
  /** CMS template name; used as the subject fallback when `subject` is unset. */
  templateName?: string;
}

export type WidgetData =
  | TextWidgetData
  | HtmlWidgetData
  | ImageWidgetData
  | BannerWidgetData
  | ButtonsWidgetData
  | VideoWidgetData
  | FormWidgetData;

/** Resolve the image filename from either `filename` (CMS config) or `fileName` (GraphQL). */
export function resolveImageFileName(image: WidgetImage | undefined): string {
  if (!image) return '';
  return image.filename || image.fileName || '';
}
