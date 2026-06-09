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
}

/** Controls which product set the ProductListWidget renders. Only DEFAULT is rendered today. */
export type ProductListWidgetMode = 'DEFAULT' | 'LATEST_VIEWED' | 'FAVORITES';

export interface ProductListWidgetData {
  title?: string;
  /** Stringified and passed as the filter query param to the product search API. */
  searchParameters?: Record<string, unknown> | null;
  /** Number of slideshow pages; total products fetched = pageCount * 4. */
  pageCount?: number;
  /**
   * false => render the slideshow carousel.
   * true or undefined => render the responsive grid (rows).
   */
  slideshowDisabled?: boolean;
  /** Show left/right navigation arrows on the slideshow. */
  displayNavigationArrows?: boolean;
  /**
   * Show pagination dots on the slideshow.
   * "Links" is the CMS label for dots, not hyperlinks.
   */
  displayNavigationLinks?: boolean;
  limitNrOfRows?: boolean;
  /** Only DEFAULT is rendered today; LATEST_VIEWED and FAVORITES are out of scope. */
  mode?: ProductListWidgetMode;
}

export type WidgetData =
  | TextWidgetData
  | HtmlWidgetData
  | ImageWidgetData
  | BannerWidgetData
  | ButtonsWidgetData
  | VideoWidgetData
  | FormWidgetData
  | ProductListWidgetData;

/** Resolve the image filename from either `filename` (CMS config) or `fileName` (GraphQL). */
export function resolveImageFileName(image: WidgetImage | undefined): string {
  if (!image) return '';
  return image.filename || image.fileName || '';
}
