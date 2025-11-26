/**
 * KYUDENCapacityFetcher - Kyushu Electric Power Company capacity data fetcher
 * 
 * TODO: Implement actual KYUDEN data fetching
 */

import { CapacityFetcher } from './base.js';

export class KYUDENCapacityFetcher extends CapacityFetcher {
  constructor(config = {}) {
    super({
      utility: 'KYUDEN',
      sourceUrl: config.sourceUrl || 'https://www.kyuden.co.jp/td_service_wheeling_rule-document_disclosure.html',
      options: config.options || {}
    });
  }

  async fetchRawData() {
    throw new Error('KYUDEN fetcher not yet implemented. Contributions welcome!');
  }

  async parseData(rawData) {
    throw new Error('KYUDEN parser not yet implemented. Contributions welcome!');
  }
}
