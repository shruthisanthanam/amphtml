/**
 * Copyright 2019 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {endsWith, startsWith} from '../../../src/string';

export class ExternalReorderHeadTransformer {
  /** constructor */
  constructor() {
    this.headComponents = {
      metaOther: [],
      scriptNonRenderDelayingExtensions: [],
      scriptRenderDelayingExtensions: [],
      linkIcons: [],
      linkResourceHints: [],
      linkStylesheetBeforeAmpCustom: [],
      other: [],
      styleAmpRuntime: null,
      metaCharset: null,
      scriptAmpEngine: null,
      scriptAmpViewer: null,
      scriptGmailAmpViewer: null,
      styleAmpCustom: null,
      linkStylesheetRuntimeCss: null,
      styleAmpBoilerplate: null,
      noscript: null,
    };
  }

  /**
   * Appends child to parent, if child is not null
   * @param {Element} parent
   * @param {Element} element
   */
  appendIfNotNull_(parent, element) {
    if (element != null) {
      parent.appendChild(element);
    }
  }

  /**
   * Appends all children to parent
   * @param {Element} parent
   * @param {Array<Element>} element
   */
  appendAll_(parent, element) {
    for (let i = 0; i < element.length; i++) {
      const child = element[i];
      parent.appendChild(child);
    }
  }

  /**
   * Reorders head like so:
   * (0) <meta charset> tag
   * (1) <style amp-runtime>
   * (2) remaining <meta> tags (those other than <meta charset>)
   * (3) AMP runtime .js <script> tag
   * (4) AMP viewer runtime .js <script> tag
   * (5) Gmail AMP viewer runtime .js <script> tag
   * (6) <script> tags for render delaying extensions
   * (7) <script> tags for remaining extensions
   * (8) <link> tag for favicon
   * (9) <link> tag for resource hints
   * (10) <link rel=stylesheet> tags before <style amp-custom>
   * (11) <style amp-custom>
   * (12) any other tags allowed in <head>
   * (13) amp boilerplate (first style amp-boilerplate, then noscript)
   *
   * http://g3doc/search/amphtml/transformers/g3doc/t/ExternalReorderHead.md
   * @param {Element} head
   * @return {Element}
   */
  reorderHead(head) {
    if (head != null) {
      for (let i = 0; i < head.children.length; i++) {
        const child = head.children.item(i);
        switch (child.tagName) {
          case 'META':
            this.registerMeta(child);
            break;
          case 'SCRIPT':
            this.registerScript(child);
            break;
          case 'STYLE':
            this.registerStyle(child);
            break;
          case 'LINK':
            this.registerLink(child);
            break;
          case 'NOSCRIPT':
            this.headComponents.noscript = child;
          default:
            if (!this.headComponents.other.includes(child)) {
              this.headComponents.other.push(child);
            }
            break;
        }
      }
    }
    head.innerHTML = '';
    this.repopulate(head);
    return head;
  }

  /**
   * Classifies all elements with meta tags
   * @param {Element} element
   *
   */
  registerMeta(element) {
    if (element.hasAttribute('charset')) {
      this.headComponents.metaCharset = element;
      return;
    }
    if (!this.headComponents.metaOther.includes(element)) {
      this.headComponents.metaOther.push(element);
      return;
    }
  }

  /**
   * Classifies all elements with script tags
   * @param {Element} element
   *
   */
  registerScript(element) {
    const src = element.getAttribute('src');
    const isAsync = element.hasAttribute('async');
    const isExtension =
      element.hasAttribute('custom-element') ||
      element.hasAttribute('custom-template') ||
      element.hasAttribute('host-service');
    if (isExtension) {
      const custom = element.getAttribute('custom-element');
      if (
        custom == 'amp-story' ||
        custom == 'amp-experiment' ||
        custom == 'amp-dynamic-css-classes'
      ) {
        this.headComponents.scriptRenderDelayingExtensions.push(element);
        return;
      }
      this.headComponents.scriptNonRenderDelayingExtensions.push(element);
      return;
    }
    if (
      isAsync &&
      startsWith(src, 'https://cdn.ampproject.org/') &&
      (endsWith(src, '/v0.js') ||
        endsWith(src, '/v0.js.br') ||
        endsWith(src, '/amp4ads-v0.js') ||
        endsWith(src, '/amp4ads-v0.js.br'))
    ) {
      this.headComponents.scriptAmpEngine = element;
      return;
    }
    if (
      isAsync &&
      startsWith(
        src,
        'https://cdn.ampproject.org/v0/amp-viewer-integration-gmail-'
      ) &&
      endsWith(src, '.js')
    ) {
      this.headComponents.scriptGmailAmpViewer = element;
      return;
    }
    if (
      isAsync &&
      (startsWith(
        src,
        'https://cdn.ampproject.org/v0/amp-viewer-integration-'
      ) ||
        (startsWith(src, 'https://cdn.ampproject.org/viewer/google/v') &&
          endsWith(src, '.js')))
    ) {
      this.headComponents.scriptAmpViewer = element;
      return;
    }
    this.headComponents.other.push(element);
  }

  /**
   * Classifies all elements with style tags
   * @param {Element} element
   *
   */
  registerStyle(element) {
    if (element.hasAttribute('amp-runtime')) {
      this.headComponents.styleAmpRuntime = element;
      return;
    }
    if (element.hasAttribute('amp-custom')) {
      this.headComponents.styleAmpCustom = element;
      return;
    }
    if (
      element.hasAttribute('amp-boilerplate') ||
      element.hasAttribute('amp4ads-boilerplate')
    ) {
      this.headComponents.styleAmpBoilerplate = element;
      return;
    }
    this.headComponents.other.push(element);
  }

  /**
   * Classifies all links
   * @param {Element} element
   *
   */
  registerLink(element) {
    const rel = element.getAttribute('rel');
    if (rel == 'stylesheet') {
      if (
        startsWith(
          element.getAttribute('href'),
          'https://cdn.ampproject.org/'
        ) &&
        endsWith(element.getAttribute('href'), '/v0.css')
      ) {
        this.headComponents.linkStylesheetRuntimeCss = element;
        return;
      }
      if (this.headComponents.styleAmpCustom == null) {
        this.headComponents.linkStylesheetBeforeAmpCustom.push(element);
        return;
      }
      return;
    }
    if (rel == 'icon' || rel == 'icon shortcut' || rel == 'shortcut icon') {
      this.headComponents.linkIcons.push(element);
      return;
    }
    if (rel == 'dns-prefetch preconnect') {
      this.headComponents.linkResourceHints.push(element);
      return;
    }
    this.headComponents.other.push(element);
  }

  /**
   * Add components back to head in specified order
   * @param {Element} head
   */
  repopulate(head) {
    this.appendIfNotNull_(head, this.headComponents.metaCharset);
    this.appendIfNotNull_(head, this.headComponents.linkStylesheetRuntimeCss);
    this.appendIfNotNull_(head, this.headComponents.styleAmpRuntime);
    this.appendAll_(head, this.headComponents.metaOther);
    this.appendIfNotNull_(head, this.headComponents.scriptAmpEngine);
    this.appendIfNotNull_(head, this.headComponents.scriptAmpViewer);
    this.appendIfNotNull_(head, this.headComponents.scriptGmailAmpViewer);
    this.appendAll_(head, this.headComponents.scriptRenderDelayingExtensions);
    this.appendAll_(
      head,
      this.headComponents.scriptNonRenderDelayingExtensions
    );
    this.appendAll_(head, this.headComponents.linkIcons);
    this.appendAll_(head, this.headComponents.linkResourceHints);
    this.appendAll_(head, this.headComponents.linkStylesheetBeforeAmpCustom);
    this.appendIfNotNull_(head, this.headComponents.styleAmpCustom);
    this.appendAll_(head, this.headComponents.other);
    this.appendIfNotNull_(head, this.headComponents.styleAmpBoilerplate);
    this.appendIfNotNull_(head, this.headComponents.noscript);
    return head;
  }
}
