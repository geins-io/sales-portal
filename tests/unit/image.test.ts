import { describe, it, expect } from 'vitest';
import {
  buildGeinsImageUrl,
  buildGeinsRawUrl,
  buildGeinsThumbnailUrl,
  GEINS_IMAGE_FOLDER,
} from '@geins/core';

const BASE = 'https://monitor.commerce.services';

describe('SDK image URL re-exports', () => {
  it('buildGeinsRawUrl builds a raw URL', () => {
    expect(buildGeinsRawUrl(BASE, 'product', 'shoe.jpg')).toBe(
      'https://monitor.commerce.services/product/raw/shoe.jpg',
    );
  });

  it('buildGeinsThumbnailUrl builds a thumbnail URL', () => {
    expect(buildGeinsThumbnailUrl(BASE, 'product', 'shoe.jpg')).toBe(
      'https://monitor.commerce.services/product/100x100/shoe.jpg',
    );
  });

  it('buildGeinsImageUrl encodes fileName', () => {
    expect(buildGeinsImageUrl(BASE, 'product', 'raw', 'my shoe (1).jpg')).toBe(
      'https://monitor.commerce.services/product/raw/my%20shoe%20(1).jpg',
    );
  });

  it('returns empty string for missing inputs', () => {
    expect(buildGeinsRawUrl('', 'product', 'shoe.jpg')).toBe('');
    expect(buildGeinsRawUrl(BASE, 'product', '')).toBe('');
  });

  it('exports GEINS_IMAGE_FOLDER constants', () => {
    expect(GEINS_IMAGE_FOLDER.RAW).toBe('raw');
    expect(GEINS_IMAGE_FOLDER.THUMB_SM).toBe('40x40');
    expect(GEINS_IMAGE_FOLDER.THUMB).toBe('100x100');
  });
});
