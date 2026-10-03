/* ========== コントローラー対応（index.html と同じフォルダに置く） ==========
   Switch Pro コントローラーなどの「標準配置」のゲームパッド用。
   ゲームにはキーボード入力として送るだけなので、ゲーム本体のルールはそのまま。

   ■ ダンジョン   左スティック(十字キー)=移動 ／ A=調べる・開ける・レバー ／ X=マップ ／ Y=メニュー(バッグ)
   ■ マップ       どれかのボタンで閉じる
   ■ メニュー     スティック・十字キー=カーソル枠 ／ L・R=どうぐ・わざ・ステータスの切り替え
                  A=決定 ／ B・Y=閉じる ／ X=すてる(2回) ／ +=中断セーブ(2回)
   ■ 戦闘コマンド 左スティック(十字キー)=選ぶ ／ A=決定 ／ B=もどる
   ■ ミニゲーム   ZL=青(カ) ／ ZR=赤(ドン)
   ■ 回避ターン   スティック・十字キー=移動 ／ ZL か ZR(おしている間)=ガード・パリィ
   ■ タイトル     A=START ／ X=つづきから
   ※ ボタンの位置は Nintendo 表記（A=右・B=下・X=上・Y=左）。Xbox 型のパッドでも位置で対応します。
*/
(function () {
  'use strict';

  /* ---- ボタン番号（標準配置）。ずれるときは ここだけ直せばよい ---- */
  const BTN = { B: 0, A: 1, Y: 2, X: 3, L: 4, R: 5, ZL: 6, ZR: 7, MINUS: 8, PLUS: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  const DEAD = 0.45;        // スティックの遊び
  const REPEAT_FIRST = 0.38; // 押しっぱなしで連続入力になるまで(秒)
  const REPEAT_RATE = 0.13;  // 連続入力の間隔(秒)

  const bridge = () => window.__gamepadBridge;

  let held = new Set();          // いま押しっぱなしにしているキー
  let prevBtn = {};              // 前フレームのボタン状態
  const rep = {};                // 方向ごとの連続入力タイマー
  let last = performance.now();

  function getPad() {
    const list = (navigator.getGamepads && navigator.getGamepads()) || [];
    for (const p of list) if (p && p.connected) return p;
    return null;
  }
  const isDown = (p, i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));

  /* スティック＋十字キー → 上下左右（斜めは強いほうの軸だけ。4方向ゲームなので） */
  function dirOf(p) {
    let x = 0, y = 0;
    if (isDown(p, BTN.LEFT)) x = -1; else if (isDown(p, BTN.RIGHT)) x = 1;
    if (isDown(p, BTN.UP)) y = -1; else if (isDown(p, BTN.DOWN)) y = 1;
    if (!x && !y) {
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.abs(ax) >= DEAD || Math.abs(ay) >= DEAD) {
        if (Math.abs(ax) >= Math.abs(ay)) x = ax < 0 ? -1 : 1; else y = ay < 0 ? -1 : 1;
      }
    }
    return { l: x < 0, r: x > 0, u: y < 0, d: y > 0 };
  }

  /* 押した瞬間 ＋ 押しっぱなしの連続入力 */
  function repeat(name, on, dt) {
    const r = rep[name] || (rep[name] = { t: 0, on: false });
    if (!on) { r.on = false; return false; }
    if (!r.on) { r.on = true; r.t = REPEAT_FIRST; return true; }
    r.t -= dt;
    if (r.t <= 0) { r.t += REPEAT_RATE; return true; }
    return false;
  }

  function clickIfShown(id) {
    const el = document.getElementById(id);
    if (el && el.offsetParent !== null && getComputedStyle(el).display !== 'none') el.click();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const b = bridge();
    const p = getPad();
    const want = new Set();   // このフレームで「おしている」ことにするキー

    if (b && p) {
      const st = b.state();
      const dir = dirOf(p);
      const btn = {};
      for (const k in BTN) btn[k] = isDown(p, BTN[k]);
      const edge = k => btn[k] && !prevBtn[k];   // 押した瞬間だけ
      const anyEdge = ['A', 'B', 'X', 'Y', 'L', 'R', 'ZL', 'ZR', 'PLUS', 'MINUS'].some(edge);

      switch (st) {
        case 'title':
          if (edge('B')) clickIfShown('startBtn');
          else if (edge('X')) clickIfShown('contBtn');
          break;

        case 'field':   // 移動は押している間ずっと
          if (dir.l) want.add('ArrowLeft'); else if (dir.r) want.add('ArrowRight');
          else if (dir.u) want.add('ArrowUp'); else if (dir.d) want.add('ArrowDown');
          if (edge('B')) want.add('KeyE');   // 調べる・開ける・レバー
          if (edge('X')) want.add('KeyM');   // マップ
          if (edge('Y')) want.add('KeyI');   // メニュー
          break;

        case 'map':
          if (anyEdge) want.add('KeyM');
          break;

        case 'bag': {   // カーソル枠は 左右キーで動く。タブ切り替えは 上下キー（ゲーム側の仕様）なので L/R に割り当てる
          if (repeat('bl', dir.l || dir.u, dt)) want.add('ArrowLeft');
          if (repeat('br', dir.r || dir.d, dt)) want.add('ArrowRight');
          if (edge('L')) want.add('ArrowUp');     // 前のタブ
          if (edge('R')) want.add('ArrowDown');   // 次のタブ
          if (edge('B')) want.add('KeyZ');        // 決定
          if (edge('A') || edge('Y')) want.add('KeyX');   // 閉じる・もどる
          if (edge('X')) want.add('KeyC');        // すてる（2回）
          if (edge('PLUS')) want.add('KeyQ');     // 中断セーブ（2回）
          break;
        }

        case 'command':   // ゲーム側は ←↑=左 ／ →↓=右
          if (repeat('cl', dir.l || dir.u, dt)) want.add('ArrowLeft');
          if (repeat('cr', dir.r || dir.d, dt)) want.add('ArrowRight');
          if (edge('B')) want.add('KeyZ');
          if (edge('A')) want.add('KeyX');
          break;

        case 'taiko':   // ZL=青(カ) ／ ZR=赤(ドン)
          if (edge('ZL')) want.add('KeyA');
          if (edge('ZR')) want.add('KeyD');
          break;

        case 'dodge':   // 移動は押している間 ／ ZL・ZR どちらかを押している間がガード
          if (dir.l) want.add('ArrowLeft'); else if (dir.r) want.add('ArrowRight');
          else if (dir.u) want.add('ArrowUp'); else if (dir.d) want.add('ArrowDown');
          if (btn.ZL || btn.ZR) want.add('KeyX');
          break;

        case 'levelup':
          if (repeat('ul', dir.l || dir.u, dt)) want.add('ArrowLeft');
          if (repeat('ur', dir.r || dir.d, dt)) want.add('ArrowRight');
          if (edge('B')) want.add('KeyZ');
          break;

        case 'ok':
          if (edge('B')) want.add('KeyZ');
          break;
      }
      prevBtn = btn;
    } else {
      prevBtn = {};
      for (const k in rep) rep[k].on = false;
    }

    // 差分をゲームに送る（押した瞬間だけのキーは、次のフレームで自然に離される）
    if (b) {
      for (const k of held) if (!want.has(k)) b.release(k);
      for (const k of want) if (!held.has(k)) b.press(k);
    }
    held = want;
  }

  addEventListener('blur', () => {   // 画面が裏に回ったときは全部離す
    const b = bridge();
    if (b) for (const k of held) b.release(k);
    held = new Set(); prevBtn = {};
  });
  addEventListener('gamepadconnected', e => console.log('[gamepad] 接続:', e.gamepad.id));
  requestAnimationFrame(frame);
})();
