{
  "_$ver": 1,
  "_$id": "minesweeper_stage_scene",
  "_$type": "Scene",
  "name": "MinesweeperStage",
  "x": 0,
  "y": 0,
  "width": 1280,
  "height": 720,
  "_$child": [
    {
      "_$ver": 1,
      "_$id": "hud_bar_root",
      "_$type": "Sprite",
      "name": "TacticalHudBar",
      "x": 20,
      "y": 16,
      "width": 310,
      "height": 64,
      "_gcmds": [
        {
          "_$type": "DrawRoundRectCmd",
          "x": 0,
          "y": 0,
          "width": 310,
          "height": 64,
          "lt": 12,
          "rt": 12,
          "lb": 12,
          "rb": 12,
          "fillColor": "#141d2c",
          "lineColor": "#304565",
          "lineWidth": 2,
          "percent": false
        },
        {
          "_$type": "DrawRoundRectCmd",
          "x": 14,
          "y": 10,
          "width": 96,
          "height": 44,
          "lt": 6,
          "rt": 6,
          "lb": 6,
          "rb": 6,
          "fillColor": "#0b0f17",
          "lineColor": "#ff3366",
          "lineWidth": 1.5,
          "percent": false
        },
        {
          "_$type": "DrawRoundRectCmd",
          "x": 200,
          "y": 10,
          "width": 96,
          "height": 44,
          "lt": 6,
          "rt": 6,
          "lb": 6,
          "rb": 6,
          "fillColor": "#0b0f17",
          "lineColor": "#00ff88",
          "lineWidth": 1.5,
          "percent": false
        }
      ],
      "_$child": [
        {
          "_$id": "hud_mine_led",
          "_$type": "Text",
          "name": "MineCounterLED",
          "x": 14,
          "y": 17,
          "width": 96,
          "height": 32,
          "text": "010",
          "font": "Courier New, monospace",
          "fontSize": 25,
          "bold": true,
          "color": "#ff3366",
          "align": "center"
        },
        {
          "_$id": "hud_face_badge",
          "_$type": "Text",
          "name": "CenterFaceIcon",
          "x": 126,
          "y": 16,
          "width": 58,
          "height": 36,
          "text": "🙂",
          "fontSize": 24,
          "color": "#e2f1ff",
          "align": "center"
        },
        {
          "_$id": "hud_timer_led",
          "_$type": "Text",
          "name": "TimerCounterLED",
          "x": 200,
          "y": 17,
          "width": 96,
          "height": 32,
          "text": "042",
          "font": "Courier New, monospace",
          "fontSize": 25,
          "bold": true,
          "color": "#00ff88",
          "align": "center"
        }
      ],
      "_zhudaMeta": {
        "assetId": "assets/prefabs/TacticalHudBar.lh",
        "category": "ui-prefab",
        "version": "3.4.2-zhuda-static-v1",
        "designCanvas": {
          "width": 330,
          "height": 84,
          "padding": 10
        },
        "targetSpec": {
          "assetName": "TacticalHudBar.lh",
          "expectedBox": {
            "x": 10,
            "y": 10,
            "width": 310,
            "height": 64
          },
          "expectedPadding": {
            "left": 10,
            "top": 10,
            "right": 10,
            "bottom": 10
          },
          "targetColors": {
            "primaryFill": "#141d2c",
            "borderStroke": "#304565",
            "accentOrText": "#ff3366"
          },
          "tolerancePx": 0,
          "toleranceDeltaE": 1.5
        }
      }
    },
    {
      "_$ver": 1,
      "_$id": "spine42_mascot_root",
      "_$type": "Sprite",
      "name": "ZhudaSpine42Mascot",
      "x": 1035,
      "y": 118,
      "width": 210,
      "height": 172,
      "_gcmds": [
        {
          "_$type": "DrawRoundRectCmd",
          "x": 0,
          "y": 0,
          "width": 210,
          "height": 172,
          "lt": 12,
          "rt": 12,
          "lb": 12,
          "rb": 12,
          "fillColor": "#141d2b",
          "lineColor": "#2c415e",
          "lineWidth": 2,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 105,
          "y": 114,
          "radius": 34,
          "fillColor": "#090d14",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 105,
          "y": 66,
          "radius": 36,
          "fillColor": "#ff9ebb",
          "lineColor": "#ff6b98",
          "lineWidth": 2,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 105,
          "y": 75,
          "radius": 20,
          "fillColor": "#ffd0df",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 82,
          "y": 34,
          "radius": 11,
          "fillColor": "#ff6b98",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 128,
          "y": 34,
          "radius": 11,
          "fillColor": "#ff6b98",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 105,
          "y": 69,
          "radius": 13,
          "fillColor": "#ffa6c2",
          "lineColor": "#e05882",
          "lineWidth": 1.5,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 91,
          "y": 56,
          "radius": 4.2,
          "fillColor": "#222222",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 119,
          "y": 56,
          "radius": 4.2,
          "fillColor": "#222222",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        }
      ],
      "_$comp": [
        {
          "_$type": "Spine42PhysicsRigComponent",
          "rigName": "ZhudaGuardianPig_v4.2",
          "defaultPose": "idle",
          "stiffness": 95,
          "damping": 0.88,
          "windAmplitude": 1.8,
          "earAngleRad": 0,
          "skinPrimaryColor": "#ff9ebb",
          "skinBorderColor": "#ff6b98",
          "bellyHighlightColor": "#ffd0df",
          "snoutColor": "#ffa6c2"
        }
      ],
      "_$child": [
        {
          "_$id": "spine42_status_label",
          "_$type": "Text",
          "name": "StatusLabel",
          "x": 0,
          "y": 128,
          "width": 210,
          "height": 18,
          "text": "Spine 4.2 豬大精靈 · [靜態預製體]",
          "fontSize": 13,
          "bold": true,
          "color": "#7df9ff",
          "align": "center"
        },
        {
          "_$id": "spine42_physics_badge",
          "_$type": "Text",
          "name": "PhysicsBadge",
          "x": 0,
          "y": 148,
          "width": 210,
          "height": 16,
          "text": "✔ PhysicsConstraint (k=95, d=0.88)",
          "fontSize": 11,
          "color": "#64ffda",
          "align": "center"
        }
      ],
      "_zhudaMeta": {
        "assetId": "assets/prefabs/ZhudaSpine42Mascot.lh",
        "category": "spine42-rig",
        "version": "3.4.2-zhuda-static-v1",
        "designCanvas": {
          "width": 230,
          "height": 192,
          "padding": 10
        },
        "targetSpec": {
          "assetName": "ZhudaSpine42Mascot.lh",
          "expectedBox": {
            "x": 10,
            "y": 10,
            "width": 210,
            "height": 172
          },
          "expectedPadding": {
            "left": 10,
            "top": 10,
            "right": 10,
            "bottom": 10
          },
          "targetColors": {
            "primaryFill": "#141d2b",
            "borderStroke": "#2c415e",
            "accentOrText": "#ff9ebb"
          },
          "tolerancePx": 0,
          "toleranceDeltaE": 1.5
        }
      }
    },
    {
      "_$ver": 1,
      "_$id": "telemetry_dash_root",
      "_$type": "Sprite",
      "name": "TelemetryDashboard",
      "x": 1035,
      "y": 302,
      "width": 225,
      "height": 392,
      "_gcmds": [
        {
          "_$type": "DrawRoundRectCmd",
          "x": 0,
          "y": 0,
          "width": 225,
          "height": 392,
          "lt": 12,
          "rt": 12,
          "lb": 12,
          "rb": 12,
          "fillColor": "#121a28",
          "lineColor": "#2d4464",
          "lineWidth": 2,
          "percent": false
        }
      ],
      "_$child": [
        {
          "_$id": "telemetry_header_txt",
          "_$type": "Text",
          "name": "HeaderTitle",
          "x": 14,
          "y": 12,
          "width": 198,
          "height": 20,
          "text": "🛡️ 豬大引擎 · 6 大基建遙測",
          "fontSize": 13,
          "bold": true,
          "color": "#64ffda"
        },
        {
          "_$id": "telemetry_body_txt",
          "_$type": "Text",
          "name": "TelemetryBody",
          "x": 14,
          "y": 36,
          "width": 198,
          "height": 340,
          "text": "[1] 拓撲載入器 (29/29 庫)\n[2] AST 自動類別反射\n[3] 原型解毒與準備守衛\n[4] Spine 4.2 PhysicsConstraint\n[5] 合批 DrawCall 對標 Three.js\n[6] 靜態資產 (.lh) & ΔE 校準",
          "fontSize": 12,
          "leading": 5,
          "color": "#cbd5e1"
        }
      ],
      "_zhudaMeta": {
        "assetId": "assets/prefabs/TelemetryDashboard.lh",
        "category": "ui-prefab",
        "version": "3.4.2-zhuda-static-v1",
        "designCanvas": {
          "width": 245,
          "height": 412,
          "padding": 10
        },
        "targetSpec": {
          "assetName": "TelemetryDashboard.lh",
          "expectedBox": {
            "x": 10,
            "y": 10,
            "width": 225,
            "height": 392
          },
          "expectedPadding": {
            "left": 10,
            "top": 10,
            "right": 10,
            "bottom": 10
          },
          "targetColors": {
            "primaryFill": "#121a28",
            "borderStroke": "#2d4464",
            "accentOrText": "#64ffda"
          },
          "tolerancePx": 0,
          "toleranceDeltaE": 1.5
        }
      }
    },
    {
      "_$ver": 1,
      "_$id": "confirm_btn_root",
      "_$type": "Sprite",
      "name": "ConfirmActionButton",
      "x": 20,
      "y": 630,
      "width": 160,
      "height": 48,
      "mouseEnabled": true,
      "_gcmds": [
        {
          "_$type": "DrawRoundRectCmd",
          "x": 0,
          "y": 0,
          "width": 160,
          "height": 48,
          "lt": 10,
          "rt": 10,
          "lb": 10,
          "rb": 10,
          "fillColor": "#1e3a5f",
          "lineColor": "#3b82f6",
          "lineWidth": 2,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 24,
          "y": 24,
          "radius": 5,
          "fillColor": "#64ffda",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        }
      ],
      "_$child": [
        {
          "_$id": "confirm_btn_label",
          "_$type": "Text",
          "name": "ActionLabel",
          "x": 12,
          "y": 0,
          "width": 148,
          "height": 48,
          "text": "⚡ DEPLOY PREFAB",
          "fontSize": 14,
          "bold": true,
          "color": "#e2f1ff",
          "align": "center",
          "valign": "middle"
        }
      ],
      "_zhudaMeta": {
        "assetId": "assets/prefabs/ConfirmActionButton.lh",
        "category": "ui-prefab",
        "version": "3.4.2-zhuda-static-v1",
        "designCanvas": {
          "width": 180,
          "height": 68,
          "padding": 10
        },
        "targetSpec": {
          "assetName": "ConfirmActionButton.lh",
          "expectedBox": {
            "x": 10,
            "y": 10,
            "width": 160,
            "height": 48
          },
          "expectedPadding": {
            "left": 10,
            "top": 10,
            "right": 10,
            "bottom": 10
          },
          "targetColors": {
            "primaryFill": "#1e3a5f",
            "borderStroke": "#3b82f6",
            "accentOrText": "#e2f1ff"
          },
          "tolerancePx": 0,
          "toleranceDeltaE": 1.5
        }
      }
    },
    {
      "_$ver": 1,
      "_$id": "nine_slice_dialog_root",
      "_$type": "Image",
      "name": "NineSliceDialogFrame",
      "x": 200,
      "y": 540,
      "width": 320,
      "height": 140,
      "sizeGrid": "16,16,16,16,0",
      "_gcmds": [
        {
          "_$type": "DrawRoundRectCmd",
          "x": 0,
          "y": 0,
          "width": 320,
          "height": 140,
          "lt": 10,
          "rt": 10,
          "lb": 10,
          "rb": 10,
          "fillColor": "#132036",
          "lineColor": "#38bdf8",
          "lineWidth": 2,
          "percent": false
        },
        {
          "_$type": "DrawRectCmd",
          "x": 16,
          "y": 16,
          "width": 288,
          "height": 108,
          "fillColor": "#0c1524",
          "lineColor": "#233858",
          "lineWidth": 1,
          "percent": false
        },
        {
          "_$type": "DrawRoundRectCmd",
          "x": 0,
          "y": 0,
          "width": 16,
          "height": 16,
          "lt": 8,
          "rt": 2,
          "lb": 2,
          "rb": 2,
          "fillColor": "#2dd4bf",
          "lineColor": "#38bdf8",
          "lineWidth": 1.5,
          "percent": false
        },
        {
          "_$type": "DrawRoundRectCmd",
          "x": 304,
          "y": 0,
          "width": 16,
          "height": 16,
          "lt": 2,
          "rt": 8,
          "lb": 2,
          "rb": 2,
          "fillColor": "#2dd4bf",
          "lineColor": "#38bdf8",
          "lineWidth": 1.5,
          "percent": false
        },
        {
          "_$type": "DrawRoundRectCmd",
          "x": 0,
          "y": 124,
          "width": 16,
          "height": 16,
          "lt": 2,
          "rt": 2,
          "lb": 8,
          "rb": 2,
          "fillColor": "#2dd4bf",
          "lineColor": "#38bdf8",
          "lineWidth": 1.5,
          "percent": false
        },
        {
          "_$type": "DrawRoundRectCmd",
          "x": 304,
          "y": 124,
          "width": 16,
          "height": 16,
          "lt": 2,
          "rt": 2,
          "lb": 2,
          "rb": 8,
          "fillColor": "#2dd4bf",
          "lineColor": "#38bdf8",
          "lineWidth": 1.5,
          "percent": false
        }
      ],
      "_$child": [
        {
          "_$id": "nine_slice_title_txt",
          "_$type": "Text",
          "name": "NineSliceHeader",
          "x": 16,
          "y": 36,
          "width": 288,
          "height": 24,
          "text": "9-SLICE (sizeGrid: 16,16,16,16,0)",
          "fontSize": 14,
          "bold": true,
          "color": "#2dd4bf",
          "align": "center"
        },
        {
          "_$id": "nine_slice_sub_txt",
          "_$type": "Text",
          "name": "NineSliceSubtitle",
          "x": 16,
          "y": 70,
          "width": 288,
          "height": 22,
          "text": "Stretched 320×140px · 4 Corners Locked 16×16px",
          "fontSize": 12,
          "color": "#e2f1ff",
          "align": "center"
        }
      ],
      "_zhudaMeta": {
        "assetId": "assets/prefabs/NineSliceDialogFrame.lh",
        "category": "nine-slice-ui",
        "version": "3.4.2-zhuda-static-v1",
        "designCanvas": {
          "width": 340,
          "height": 160,
          "padding": 10
        },
        "targetSpec": {
          "assetName": "NineSliceDialogFrame.lh",
          "expectedBox": {
            "x": 10,
            "y": 10,
            "width": 320,
            "height": 140
          },
          "expectedPadding": {
            "left": 10,
            "top": 10,
            "right": 10,
            "bottom": 10
          },
          "targetColors": {
            "primaryFill": "#132036",
            "borderStroke": "#38bdf8",
            "accentOrText": "#2dd4bf"
          },
          "tolerancePx": 0,
          "toleranceDeltaE": 1.5
        },
        "nineSliceSpec": {
          "sizeGrid": [
            16,
            16,
            16,
            16,
            0
          ],
          "baseWidth": 160,
          "baseHeight": 80
        }
      }
    },
    {
      "_$ver": 1,
      "_$id": "particle_explosion_root",
      "_$type": "Sprite",
      "name": "MineExplosionParticle",
      "x": 550,
      "y": 270,
      "width": 176,
      "height": 176,
      "_gcmds": [
        {
          "_$type": "DrawRoundRectCmd",
          "x": 0,
          "y": 0,
          "width": 176,
          "height": 176,
          "lt": 16,
          "rt": 16,
          "lb": 16,
          "rb": 16,
          "fillColor": "#231424",
          "lineColor": "#ff5533",
          "lineWidth": 2,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 88,
          "y": 88,
          "radius": 68,
          "fillColor": null,
          "lineColor": "#ffaa00",
          "lineWidth": 2,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 88,
          "y": 88,
          "radius": 26,
          "fillColor": "#ff5533",
          "lineColor": "#ffaa00",
          "lineWidth": 3,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 128.1,
          "y": 87.6,
          "radius": 3.2,
          "fillColor": "#ffaa00",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 118.2,
          "y": 94.9,
          "radius": 4.8,
          "fillColor": "#ff5533",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 115.8,
          "y": 106.8,
          "radius": 6.4,
          "fillColor": "#64ffda",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 110.9,
          "y": 112.8,
          "radius": 3.2,
          "fillColor": "#ffaa00",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 103.7,
          "y": 111,
          "radius": 4.8,
          "fillColor": "#ff5533",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 94,
          "y": 118.2,
          "radius": 6.4,
          "fillColor": "#64ffda",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 88,
          "y": 120.7,
          "radius": 3.2,
          "fillColor": "#ffaa00",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 79,
          "y": 128.9,
          "radius": 4.8,
          "fillColor": "#ff5533",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 72.9,
          "y": 114.2,
          "radius": 6.4,
          "fillColor": "#64ffda",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 59.8,
          "y": 116.4,
          "radius": 3.2,
          "fillColor": "#ffaa00",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 60.7,
          "y": 105.3,
          "radius": 4.8,
          "fillColor": "#ff5533",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 49.8,
          "y": 96.5,
          "radius": 6.4,
          "fillColor": "#64ffda",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 61.1,
          "y": 87.9,
          "radius": 3.2,
          "fillColor": "#ffaa00",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 58.1,
          "y": 82.7,
          "radius": 4.8,
          "fillColor": "#ff5533",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 51.8,
          "y": 68,
          "radius": 6.4,
          "fillColor": "#64ffda",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 64.3,
          "y": 62.9,
          "radius": 3.2,
          "fillColor": "#ffaa00",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 66.3,
          "y": 53.5,
          "radius": 4.8,
          "fillColor": "#ff5533",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 75.9,
          "y": 48.2,
          "radius": 6.4,
          "fillColor": "#64ffda",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 86,
          "y": 48.5,
          "radius": 3.2,
          "fillColor": "#ffaa00",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 99.8,
          "y": 46.6,
          "radius": 4.8,
          "fillColor": "#ff5533",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 102.4,
          "y": 63.6,
          "radius": 6.4,
          "fillColor": "#64ffda",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 119.4,
          "y": 60.3,
          "radius": 3.2,
          "fillColor": "#ffaa00",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 115.3,
          "y": 70.9,
          "radius": 4.8,
          "fillColor": "#ff5533",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 130.5,
          "y": 80.4,
          "radius": 6.4,
          "fillColor": "#64ffda",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        }
      ],
      "_$comp": [
        {
          "_$type": "ZhudaParticleEmitterComponent",
          "emitterName": "TacticalMineBurst_v1",
          "burstCount": 24,
          "emissionRate": 36,
          "lifetimeMs": 850,
          "startSpeed": 165,
          "gravityY": 220,
          "seed": 20261028,
          "previewTimestampMs": 240,
          "primaryColor": "#ff5533",
          "secondaryColor": "#ffaa00",
          "sparkColor": "#64ffda",
          "coreGlowColor": "#231424"
        }
      ],
      "_$child": [
        {
          "_$id": "particle_badge_txt",
          "_$type": "Text",
          "name": "ParticleSnapshotLabel",
          "x": 0,
          "y": 152,
          "width": 176,
          "height": 18,
          "text": "Particle Snapshot @ 240ms",
          "fontSize": 11,
          "bold": true,
          "color": "#ffaa00",
          "align": "center"
        }
      ],
      "_zhudaMeta": {
        "assetId": "assets/prefabs/MineExplosionParticle.lh",
        "category": "particle-emitter",
        "version": "3.4.2-zhuda-static-v1",
        "designCanvas": {
          "width": 200,
          "height": 200,
          "padding": 12
        },
        "targetSpec": {
          "assetName": "MineExplosionParticle.lh",
          "expectedBox": {
            "x": 12,
            "y": 12,
            "width": 176,
            "height": 176
          },
          "expectedPadding": {
            "left": 12,
            "top": 12,
            "right": 12,
            "bottom": 12
          },
          "targetColors": {
            "primaryFill": "#231424",
            "borderStroke": "#ff5533",
            "accentOrText": "#ffaa00"
          },
          "tolerancePx": 0,
          "toleranceDeltaE": 1.5
        }
      }
    },
    {
      "_$ver": 1,
      "_$id": "unity_crystal_guardian_root",
      "_$type": "Sprite",
      "name": "UnityCrystalGuardian",
      "x": 760,
      "y": 510,
      "width": 200,
      "height": 168,
      "_gcmds": [
        {
          "_$type": "DrawRoundRectCmd",
          "x": 0,
          "y": 0,
          "width": 200,
          "height": 168,
          "lt": 12,
          "rt": 12,
          "lb": 12,
          "rb": 12,
          "fillColor": "#111c2d",
          "lineColor": "#38bdf8",
          "lineWidth": 2,
          "percent": false
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 100,
          "y": 74,
          "radius": 46,
          "fillColor": "#0a1220",
          "lineColor": "#0284c7",
          "lineWidth": 2,
          "percent": false
        },
        {
          "_$type": "DrawPolyCmd",
          "x": 100,
          "y": 74,
          "points": [
            0,
            -34,
            26,
            -12,
            20,
            26,
            0,
            36,
            -20,
            26,
            -26,
            -12
          ],
          "fillColor": "#38bdf8",
          "lineColor": "#e0f2fe",
          "lineWidth": 2
        },
        {
          "_$type": "DrawCircleCmd",
          "x": 100,
          "y": 74,
          "radius": 12,
          "fillColor": "#4ade80",
          "lineColor": "#ffffff",
          "lineWidth": 1.5,
          "percent": false
        }
      ],
      "_$comp": [
        {
          "_$type": "ZhudaAnimatorControllerComponent",
          "controllerName": "CrystalGuardian.controller",
          "defaultState": "Idle",
          "unityGuid": "u-crystal-004",
          "layaPosRH": "2.2,1.8,1.5",
          "layaEulerRH": "15,-45,-15",
          "spine42RigFile": "ZhudaGuardianPig_v4.2.skel",
          "statesJson": "[{\"name\":\"Idle\",\"motionClip\":\"Crystal_Idle.anim\",\"speed\":1,\"loop\":true,\"spineAnimationName\":\"idle\",\"scalePulseAmplitude\":0.04,\"rotationSpeedDeg\":35,\"tintHex\":\"#38bdf8\"},{\"name\":\"Charge\",\"motionClip\":\"Crystal_Charge.anim\",\"speed\":1.8,\"loop\":true,\"spineAnimationName\":\"thinking\",\"scalePulseAmplitude\":0.14,\"rotationSpeedDeg\":140,\"tintHex\":\"#fbbf24\"},{\"name\":\"Burst\",\"motionClip\":\"Crystal_Burst.anim\",\"speed\":2.5,\"loop\":false,\"spineAnimationName\":\"cheer\",\"scalePulseAmplitude\":0.28,\"rotationSpeedDeg\":320,\"tintHex\":\"#4ade80\"}]",
          "transitionsJson": "[{\"fromState\":\"Idle\",\"toState\":\"Charge\",\"durationSec\":0.2,\"hasExitTime\":false,\"conditions\":[{\"parameter\":\"Speed\",\"mode\":\"Greater\",\"threshold\":0.5}]},{\"fromState\":\"Charge\",\"toState\":\"Burst\",\"durationSec\":0.15,\"hasExitTime\":false,\"conditions\":[{\"parameter\":\"Overcharge\",\"mode\":\"If\"}]},{\"fromState\":\"Burst\",\"toState\":\"Idle\",\"durationSec\":0.25,\"hasExitTime\":true,\"conditions\":[{\"parameter\":\"Speed\",\"mode\":\"Less\",\"threshold\":0.1}]}]",
          "parametersJson": "[{\"name\":\"Speed\",\"type\":\"float\",\"defaultValue\":0},{\"name\":\"Overcharge\",\"type\":\"bool\",\"defaultValue\":false},{\"name\":\"BurstTrigger\",\"type\":\"trigger\",\"defaultValue\":false}]"
        }
      ],
      "_$child": [
        {
          "_$id": "unity_guardian_title",
          "_$type": "Text",
          "name": "UnityNodeBadge",
          "x": 0,
          "y": 126,
          "width": 200,
          "height": 18,
          "text": "Unity → Laya [CrystalGuardian]",
          "fontSize": 12,
          "bold": true,
          "color": "#4ade80",
          "align": "center"
        },
        {
          "_$id": "unity_animator_status",
          "_$type": "Text",
          "name": "AnimatorStateLabel",
          "x": 0,
          "y": 145,
          "width": 200,
          "height": 16,
          "text": "Animator: Idle (RH: 2.2, 1.8, 1.5)",
          "fontSize": 11,
          "color": "#7df9ff",
          "align": "center"
        }
      ],
      "_zhudaMeta": {
        "assetId": "assets/prefabs/UnityCrystalGuardian.lh",
        "category": "unity-migrated",
        "version": "3.4.2-zhuda-static-v1",
        "designCanvas": {
          "width": 220,
          "height": 188,
          "padding": 10
        },
        "targetSpec": {
          "assetName": "UnityCrystalGuardian.lh",
          "expectedBox": {
            "x": 10,
            "y": 10,
            "width": 200,
            "height": 168
          },
          "expectedPadding": {
            "left": 10,
            "top": 10,
            "right": 10,
            "bottom": 10
          },
          "targetColors": {
            "primaryFill": "#111c2d",
            "borderStroke": "#38bdf8",
            "accentOrText": "#4ade80"
          },
          "tolerancePx": 0,
          "toleranceDeltaE": 1.5
        }
      }
    }
  ],
  "_zhudaMeta": {
    "assetId": "assets/scenes/MinesweeperStage.ls",
    "category": "scene-lh",
    "version": "3.4.2-zhuda-static-v1",
    "designCanvas": {
      "width": 1280,
      "height": 720,
      "padding": 0
    }
  }
}