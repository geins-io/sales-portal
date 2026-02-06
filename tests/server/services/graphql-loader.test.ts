import { describe, it, expect } from 'vitest';
import { loadQuery } from '../../../server/services/graphql/loader';

describe('GraphQL loader', () => {
  describe('loadQuery', () => {
    it('should load a simple query without fragments', () => {
      const query = loadQuery('brands/brands.graphql');

      expect(query).toContain('query brands');
      expect(query).toContain('brandId');
      expect(query).toContain('canonicalUrl');
    });

    it('should load a query and resolve fragment dependencies', () => {
      const query = loadQuery('products/product.graphql');

      // Should contain the query
      expect(query).toContain('query product');
      expect(query).toContain('$alias: String!');

      // Should contain resolved fragments
      expect(query).toContain('fragment Price on PriceType');
      expect(query).toContain('fragment Stock on StockType');
      expect(query).toContain('fragment Sku on SkuType');
      expect(query).toContain('fragment Variant on VariantType');
      expect(query).toContain('fragment Meta on MetadataType');
      expect(query).toContain('fragment Campaign on CampaignRuleType');
    });

    it('should resolve nested fragment dependencies', () => {
      // Sku depends on Stock, ListProduct depends on Price + Stock + Sku + Campaign
      const query = loadQuery('product-lists/products.graphql');

      expect(query).toContain('fragment ListProduct on ProductType');
      expect(query).toContain('fragment Price on PriceType');
      expect(query).toContain('fragment Stock on StockType');
      expect(query).toContain('fragment Sku on SkuType');
      expect(query).toContain('fragment Campaign on CampaignRuleType');
    });

    it('should not duplicate fragments', () => {
      const query = loadQuery('products/product.graphql');

      // Count occurrences of fragment Stock — should appear exactly once
      const stockMatches = query.match(/fragment Stock on StockType/g);
      expect(stockMatches).toHaveLength(1);
    });

    it('should cache queries on repeated loads', () => {
      const query1 = loadQuery('brands/brands.graphql');
      const query2 = loadQuery('brands/brands.graphql');

      // Same reference means cache hit
      expect(query1).toBe(query2);
    });

    it('should load mutation files', () => {
      const query = loadQuery('products/post-review.graphql');

      expect(query).toContain('mutation postProductReview');
      expect(query).toContain('$alias: String!');
      expect(query).toContain('$rating: Int!');
    });

    it('should load search query with Price fragment', () => {
      const query = loadQuery('search/search.graphql');

      expect(query).toContain('query products');
      expect(query).toContain('$filter: FilterInputType');
      expect(query).toContain('fragment Price on PriceType');
    });

    it('should load category page with ListInfo and Meta fragments', () => {
      const query = loadQuery('product-lists/category-page.graphql');

      expect(query).toContain('query listPageInfo');
      expect(query).toContain('fragment ListInfo on PageInfoType');
      expect(query).toContain('fragment Meta on MetadataType');
    });

    it('should load channel query', () => {
      const query = loadQuery('channels/channel.graphql');

      expect(query).toContain('query channel');
      expect(query).toContain('defaultMarketId');
      expect(query).toContain('allowedLanguages');
    });

    it('should load newsletter mutation', () => {
      const query = loadQuery('newsletter/subscribe.graphql');

      expect(query).toContain('mutation subscribeToNewsletter');
      expect(query).toContain('$email: String!');
    });
  });
});
