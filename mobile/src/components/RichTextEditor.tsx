/**
 * RichTextEditor
 *
 * A WebView-based rich text editor that outputs real HTML.
 * Uses contenteditable + document.execCommand for bold, italic, links, alignment.
 * No markdown — the body is always proper HTML.
 */

import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface RichTextEditorRef {
  getHtml: () => Promise<string>;
  sendCommand: (cmd: string, value?: string) => void;
  focus: () => void;
}

interface Props {
  initialHtml?: string;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  primaryColor?: string;
  textColor?: string;
  backgroundColor?: string;
  placeholderColor?: string;
  onHeightChange?: (height: number) => void;
  onContentChange?: (hasContent: boolean) => void;
  onFmtStateChange?: (state: { bold: boolean; italic: boolean; insertUnorderedList: boolean }) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

const RichTextEditor = forwardRef<RichTextEditorRef, Props>((props, ref) => {
  const {
    initialHtml = '',
    placeholder = 'Write your message…',
    minHeight = 180,
    maxHeight,
    primaryColor = '#0F8F83',
    textColor = '#1e293b',
    backgroundColor = '#ffffff',
    placeholderColor = '#94a3b8',
    onHeightChange,
    onContentChange,
    onFmtStateChange,
    onFocus,
    onBlur,
  } = props;

  const scrollable = maxHeight !== undefined;

  const webviewRef = useRef<WebView>(null);
  const htmlResolversRef = useRef<Map<string, (html: string) => void>>(new Map());

  const escHtml = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');

  const editorHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    background: ${backgroundColor};
    ${scrollable ? 'overflow: hidden;' : ''}
  }
  #editor {
    outline: none;
    min-height: ${minHeight}px;
    padding: 2px 0 8px 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 16px;
    line-height: 1.65;
    color: ${textColor};
    word-break: break-word;
    -webkit-user-select: text;
    user-select: text;
    caret-color: ${primaryColor};
    ${scrollable ? `height: ${maxHeight}px; overflow-y: auto; -webkit-overflow-scrolling: touch;` : ''}
  }
  #editor:empty:before {
    content: attr(data-placeholder);
    color: ${placeholderColor};
    pointer-events: none;
  }
  a { color: ${primaryColor}; text-decoration: underline; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin: 4px 0; }
  p { margin: 0 0 8px 0; }
  p:last-child { margin-bottom: 0; }
</style>
</head>
<body>
<div id="editor" contenteditable="true" data-placeholder="${escHtml(placeholder)}">${escHtml(initialHtml)}</div>
<script>
  var editor = document.getElementById('editor');
  var savedRange = null;

  // ── Our own format state — do NOT rely on queryCommandState (unreliable on iOS) ──
  var fmt = { bold: false, italic: false, bullets: false };

  function postMessage(obj) {
    window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  }

  function sendHeight() {
    var h = Math.max(${minHeight}, document.documentElement.scrollHeight);
    postMessage({ type: 'height', value: h });
    var text = editor.innerText || '';
    postMessage({ type: 'hasContent', value: text.trim().length > 0 });
  }

  function scrollCursorIntoView() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    var rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    // Use visualViewport when available — it shrinks when the iOS floating
    // toolbar (up/down/checkmark) appears, giving us the true visible height.
    var visibleHeight = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
    // Keep the caret at least 56px above the bottom of the visible area
    // (covers the floating toolbar + a comfortable gap).
    var clearance = 56;
    var visibleBottom = visibleHeight - clearance;

    if (rect.bottom > visibleBottom) {
      var overflow = rect.bottom - visibleBottom;
      editor.scrollTop += overflow + 4;
    } else if (rect.top < 8) {
      editor.scrollTop += rect.top - 8;
    }
  }

  // Re-run when the keyboard/toolbar first appears (significant height drop only).
  // A threshold of 40px filters out scroll-bounce micro-resizes that would
  // otherwise snap the user's manual scroll position back to the caret.
  if (window.visualViewport) {
    var lastVVHeight = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', function() {
      var newHeight = window.visualViewport.height;
      var delta = lastVVHeight - newHeight;
      lastVVHeight = newHeight;
      // Only react when the toolbar/keyboard causes a meaningful height reduction
      if (delta > 40) {
        setTimeout(scrollCursorIntoView, 50);
      }
    });
  }

  function broadcastFmt() {
    postMessage({ type: 'fmtState', value: { bold: fmt.bold, italic: fmt.italic, insertUnorderedList: fmt.bullets } });
  }

  // ── Selection helpers ──
  var editorHasFocus = false;
  var pendingCmd = null;
  var pendingValue = null;

  function saveSelection() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    if (!savedRange) return;
    var sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  }

  // ── Sync fmt state from actual DOM when cursor moves ──
  // This handles the case where the user taps into already-bold text etc.
  function syncFmtFromDOM() {
    var newBold = document.queryCommandState('bold');
    var newItalic = document.queryCommandState('italic');
    var newBullets = document.queryCommandState('insertUnorderedList');
    if (newBold !== fmt.bold || newItalic !== fmt.italic || newBullets !== fmt.bullets) {
      fmt.bold = newBold;
      fmt.italic = newItalic;
      fmt.bullets = newBullets;
      broadcastFmt();
    }
  }

  // ── Core command executor ──
  function doExecCommand(cmd, value) {
    if (cmd === 'insertLink') {
      var data = JSON.parse(value);
      var sel = window.getSelection();
      if (savedRange) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
      var selectedText = sel && sel.toString().trim();
      if (selectedText) {
        document.execCommand('createLink', false, data.url);
        var links = editor.querySelectorAll('a');
        links.forEach(function(a) {
          a.style.color = '${primaryColor}';
          a.style.textDecoration = 'underline';
        });
      } else {
        var linkHtml = '<a href="' + data.url + '" style="color:${primaryColor};text-decoration:underline;">' + (data.text || data.url) + '</a>';
        document.execCommand('insertHTML', false, linkHtml);
      }
      sendHeight();
      return;
    }
    if (cmd === 'formatBlock') {
      document.execCommand('formatBlock', false, value);
      sendHeight();
      return;
    }
    if (cmd === 'bold' || cmd === 'italic') {
      // Toggle our own state flag — do NOT read queryCommandState here
      var isOn = (cmd === 'bold') ? fmt.bold : fmt.italic;
      var willBeOn = !isOn;

      // Check if there is a non-collapsed selection (text selected)
      var sel = window.getSelection();
      var hasSelection = sel && !sel.isCollapsed;

      if (hasSelection) {
        // Apply/remove formatting on selected text
        // Use execCommand which toggles based on current selection state
        // We need to ensure we're going to the right state.
        // queryCommandState is reliable for selected-text case on iOS — only
        // unreliable for the "cursor only / typing mode" case.
        var domState = document.queryCommandState(cmd);
        if (domState !== willBeOn) {
          document.execCommand(cmd, false, null);
        }
        // After applying to selection, re-read DOM state to be accurate
        if (cmd === 'bold') fmt.bold = document.queryCommandState('bold');
        else fmt.italic = document.queryCommandState('italic');
      } else {
        // No selection — typing mode toggle
        // execCommand toggles typing mode but queryCommandState is unreliable here on iOS.
        // We just call execCommand once and trust our own flag.
        document.execCommand(cmd, false, null);
        if (cmd === 'bold') fmt.bold = willBeOn;
        else fmt.italic = willBeOn;
      }

      broadcastFmt();
      sendHeight();
      return;
    }
    if (cmd === 'insertUnorderedList') {
      document.execCommand('insertUnorderedList', false, null);
      fmt.bullets = document.queryCommandState('insertUnorderedList');
      broadcastFmt();
      sendHeight();
      return;
    }
    document.execCommand(cmd, false, value || null);
    sendHeight();
  }

  // ── Event listeners ──
  editor.addEventListener('keyup', function() {
    sendHeight();
    syncFmtFromDOM();
    ${scrollable ? 'scrollCursorIntoView();' : ''}
  });
  editor.addEventListener('input', function() {
    sendHeight();
    ${scrollable ? 'scrollCursorIntoView();' : ''}
  });
  editor.addEventListener('focus', function() {
    editorHasFocus = true;
    if (pendingCmd !== null) {
      var cmd = pendingCmd;
      var val = pendingValue;
      pendingCmd = null;
      pendingValue = null;
      restoreSelection();
      doExecCommand(cmd, val);
    }
    postMessage({ type: 'focus' });
  });
  editor.addEventListener('blur', function() {
    editorHasFocus = false;
    saveSelection();
    postMessage({ type: 'blur' });
  });
  // Sync fmt state whenever the user moves the cursor (taps into styled text)
  editor.addEventListener('mouseup', syncFmtFromDOM);
  editor.addEventListener('touchend', function() {
    // Small delay to let iOS settle the selection before reading state
    setTimeout(syncFmtFromDOM, 80);
  });
  editor.addEventListener('keydown', function(e) {
    // Sync on arrow/home/end keys
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End') {
      setTimeout(syncFmtFromDOM, 30);
    }
  });
  document.addEventListener('selectionchange', function() {
    if (document.activeElement === editor) {
      saveSelection();
    }
  });

  // ── Commands from React Native ──
  window.execEditorCommand = function(cmd, value) {
    if (cmd === 'getHtml') {
      var id = value;
      postMessage({ type: 'htmlResult', id: id, html: editor.innerHTML });
      return;
    }
    if (!editorHasFocus) {
      pendingCmd = cmd;
      pendingValue = value;
      editor.focus();
      return;
    }
    restoreSelection();
    doExecCommand(cmd, value);
  };

  document.execCommand('styleWithCSS', false, 'true');
  sendHeight();
</script>
</body>
</html>`;

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data) as {
          type: string;
          value?: number | boolean | { bold: boolean; italic: boolean; insertUnorderedList: boolean };
          id?: string;
          html?: string;
        };
        if (msg.type === 'height' && typeof msg.value === 'number') {
          onHeightChange?.(msg.value);
        } else if (msg.type === 'hasContent' && typeof msg.value === 'boolean') {
          onContentChange?.(msg.value);
        } else if (msg.type === 'fmtState' && msg.value && typeof msg.value === 'object') {
          onFmtStateChange?.(msg.value as { bold: boolean; italic: boolean; insertUnorderedList: boolean });
        } else if (msg.type === 'focus') {
          onFocus?.();
        } else if (msg.type === 'blur') {
          onBlur?.();
        } else if (msg.type === 'htmlResult' && msg.id && msg.html !== undefined) {
          const resolve = htmlResolversRef.current.get(msg.id);
          if (resolve) {
            htmlResolversRef.current.delete(msg.id);
            resolve(msg.html);
          }
        }
      } catch (_) {
        // ignore
      }
    },
    [onHeightChange, onContentChange, onFmtStateChange, onFocus, onBlur]
  );

  useImperativeHandle(ref, () => ({
    getHtml: () => {
      return new Promise<string>((resolve) => {
        const id = `req_${Date.now()}_${Math.random()}`;
        htmlResolversRef.current.set(id, resolve);
        // Timeout safety — resolve with empty string if no response
        setTimeout(() => {
          if (htmlResolversRef.current.has(id)) {
            htmlResolversRef.current.delete(id);
            resolve('');
          }
        }, 3000);
        webviewRef.current?.injectJavaScript(
          `window.execEditorCommand('getHtml', '${id}'); true;`
        );
      });
    },
    sendCommand: (cmd: string, value?: string) => {
      const safeValue = value ? JSON.stringify(value) : 'null';
      webviewRef.current?.injectJavaScript(
        `window.execEditorCommand(${JSON.stringify(cmd)}, ${safeValue}); true;`
      );
    },
    focus: () => {
      webviewRef.current?.injectJavaScript(`editor.focus(); true;`);
    },
  }));

  return (
    <View style={[styles.container, { minHeight }, scrollable && { height: maxHeight, maxHeight }]}>
      <WebView
        ref={webviewRef}
        source={{ html: editorHtml }}
        style={[styles.webview, scrollable ? { height: maxHeight } : { minHeight }]}
        onMessage={handleMessage}
        scrollEnabled={scrollable}
        showsVerticalScrollIndicator={scrollable}
        showsHorizontalScrollIndicator={false}
        keyboardDisplayRequiresUserAction={false}
        automaticallyAdjustContentInsets={false}
        nestedScrollEnabled
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        originWhitelist={['*']}
      />
    </View>
  );
});

RichTextEditor.displayName = 'RichTextEditor';
export default RichTextEditor;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  webview: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
