{
  "_$ver": 1,
  "_$id": "slot_machine_scene",
  "_$type": "Scene",
  "name": "SlotMachineScene",
  "x": 0,
  "y": 0,
  "width": 1280,
  "height": 720,
  "_$child": [
    {
      "_$id": "background",
      "_$type": "Sprite",
      "name": "Background",
      "x": 0,
      "y": 0,
      "width": 1280,
      "height": 720,
      "_gcmds": [
        {
          "_$type": "DrawRectCmd",
          "x": 0,
          "y": 0,
          "width": 1280,
          "height": 720,
          "fillColor": "#07101f",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        }
      ],
      "alpha": 1
    },
    {
      "_$id": "background_glow",
      "_$type": "Sprite",
      "name": "BackgroundGlow",
      "x": 0,
      "y": 0,
      "width": 1280,
      "height": 720,
      "alpha": 0.28,
      "_$child": [],
      "_gcmds": [
        {
          "_$type": "DrawCircleCmd",
          "x": 640,
          "y": 318,
          "radius": 390,
          "fillColor": "#112744",
          "lineColor": null,
          "lineWidth": 0,
          "percent": false
        }
      ]
    },
    {
      "_$id": "title",
      "_$type": "Label",
      "name": "Title",
      "x": 72,
      "y": 36,
      "width": 520,
      "height": 46,
      "text": "NEON REELS",
      "font": "Arial",
      "fontSize": 30,
      "bold": true,
      "color": "#7fe3d8",
      "align": "left",
      "valign": "middle",
      "padding": [
        1,
        0,
        0,
        0
      ]
    },
    {
      "_$id": "subtitle",
      "_$type": "Label",
      "name": "Subtitle",
      "x": 76,
      "y": 82,
      "width": 620,
      "height": 22,
      "text": "SLOT MACHINE SCENE · SHARED ZHUDA PREFAB",
      "font": "Arial",
      "fontSize": 12,
      "bold": false,
      "color": "#7891b8",
      "align": "left",
      "valign": "middle",
      "padding": [
        1,
        0,
        0,
        0
      ]
    },
    {
      "_$id": "machine_frame",
      "_$type": "Sprite",
      "name": "MachineFrame",
      "x": 84,
      "y": 122,
      "width": 1112,
      "height": 540,
      "_gcmds": [
        {
          "_$type": "DrawRoundRectCmd",
          "x": 0,
          "y": 0,
          "width": 1112,
          "height": 540,
          "lt": 22,
          "rt": 22,
          "lb": 22,
          "rb": 22,
          "fillColor": "#0c1729",
          "lineColor": "#294563",
          "lineWidth": 2,
          "percent": false
        }
      ],
      "_$child": [
        {
          "_$id": "machine_header",
          "_$type": "Sprite",
          "name": "MachineHeader",
          "x": 27,
          "y": 23,
          "width": 1058,
          "height": 62,
          "_gcmds": [
            {
              "_$type": "DrawRoundRectCmd",
              "x": 0,
              "y": 0,
              "width": 1058,
              "height": 62,
              "lt": 14,
              "rt": 14,
              "lb": 14,
              "rb": 14,
              "fillColor": "#101f35",
              "lineColor": "#243e5c",
              "lineWidth": 2,
              "percent": false
            }
          ],
          "_$child": [
            {
              "_$id": "header_title",
              "_$type": "Label",
              "name": "HeaderTitle",
              "x": 22,
              "y": 8,
              "width": 300,
              "height": 24,
              "text": "JACKPOT RUN",
              "font": "Arial",
              "fontSize": 17,
              "bold": true,
              "color": "#ffe89a",
              "align": "left",
              "valign": "middle",
              "padding": [
                1,
                0,
                0,
                0
              ]
            },
            {
              "_$id": "header_balance",
              "_$type": "Label",
              "name": "HeaderBalance",
              "x": 700,
              "y": 8,
              "width": 330,
              "height": 24,
              "text": "BALANCE  12,480",
              "font": "Arial",
              "fontSize": 16,
              "bold": true,
              "color": "#b8c9e6",
              "align": "right",
              "valign": "middle",
              "padding": [
                1,
                0,
                0,
                0
              ]
            },
            {
              "_$id": "header_reels",
              "_$type": "Label",
              "name": "HeaderReels",
              "x": 22,
              "y": 33,
              "width": 300,
              "height": 16,
              "text": "5 × 3 REEL WINDOW",
              "font": "Arial",
              "fontSize": 10,
              "bold": false,
              "color": "#7891b8",
              "align": "left",
              "valign": "middle",
              "padding": [
                1,
                0,
                0,
                0
              ]
            }
          ]
        },
        {
          "_$id": "reel_window",
          "_$type": "Sprite",
          "name": "ReelWindow",
          "x": 27,
          "y": 95,
          "width": 1058,
          "height": 370,
          "_gcmds": [
            {
              "_$type": "DrawRoundRectCmd",
              "x": 0,
              "y": 0,
              "width": 1058,
              "height": 370,
              "lt": 16,
              "rt": 16,
              "lb": 16,
              "rb": 16,
              "fillColor": "#091423",
              "lineColor": "#203a58",
              "lineWidth": 2,
              "percent": false
            }
          ],
          "_$child": [
            {
              "_$id": "reels",
              "_$type": "Sprite",
              "name": "Reels",
              "x": 28,
              "y": 12,
              "width": 1002,
              "height": 240,
              "_$child": [
                {
                  "_$id": "reel_cell_1_1",
                  "_$type": "Sprite",
                  "name": "ReelCell_1_1",
                  "x": 0,
                  "y": 0,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#0e1c31",
                      "lineColor": "#1c3652",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_2_1",
                  "_$type": "Sprite",
                  "name": "ReelCell_2_1",
                  "x": 202,
                  "y": 0,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#0e1c31",
                      "lineColor": "#1c3652",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_3_1",
                  "_$type": "Sprite",
                  "name": "ReelCell_3_1",
                  "x": 404,
                  "y": 0,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#0e1c31",
                      "lineColor": "#1c3652",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_4_1",
                  "_$type": "Sprite",
                  "name": "ReelCell_4_1",
                  "x": 606,
                  "y": 0,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#0e1c31",
                      "lineColor": "#1c3652",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_5_1",
                  "_$type": "Sprite",
                  "name": "ReelCell_5_1",
                  "x": 808,
                  "y": 0,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#0e1c31",
                      "lineColor": "#1c3652",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_1_2",
                  "_$type": "Sprite",
                  "name": "ReelCell_1_2",
                  "x": 0,
                  "y": 120,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#122842",
                      "lineColor": "#2d7180",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_2_2",
                  "_$type": "Sprite",
                  "name": "ReelCell_2_2",
                  "x": 202,
                  "y": 120,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#122842",
                      "lineColor": "#2d7180",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_3_2",
                  "_$type": "Sprite",
                  "name": "ReelCell_3_2",
                  "x": 404,
                  "y": 120,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#122842",
                      "lineColor": "#2d7180",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_4_2",
                  "_$type": "Sprite",
                  "name": "ReelCell_4_2",
                  "x": 606,
                  "y": 120,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#122842",
                      "lineColor": "#2d7180",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_5_2",
                  "_$type": "Sprite",
                  "name": "ReelCell_5_2",
                  "x": 808,
                  "y": 120,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#122842",
                      "lineColor": "#2d7180",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_1_3",
                  "_$type": "Sprite",
                  "name": "ReelCell_1_3",
                  "x": 0,
                  "y": 240,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#0e1c31",
                      "lineColor": "#1c3652",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_2_3",
                  "_$type": "Sprite",
                  "name": "ReelCell_2_3",
                  "x": 202,
                  "y": 240,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#0e1c31",
                      "lineColor": "#1c3652",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_3_3",
                  "_$type": "Sprite",
                  "name": "ReelCell_3_3",
                  "x": 404,
                  "y": 240,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#0e1c31",
                      "lineColor": "#1c3652",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_4_3",
                  "_$type": "Sprite",
                  "name": "ReelCell_4_3",
                  "x": 606,
                  "y": 240,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#0e1c31",
                      "lineColor": "#1c3652",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "reel_cell_5_3",
                  "_$type": "Sprite",
                  "name": "ReelCell_5_3",
                  "x": 808,
                  "y": 240,
                  "width": 194,
                  "height": 112,
                  "_gcmds": [
                    {
                      "_$type": "DrawRoundRectCmd",
                      "x": 0,
                      "y": 0,
                      "width": 194,
                      "height": 112,
                      "lt": 12,
                      "rt": 12,
                      "lb": 12,
                      "rb": 12,
                      "fillColor": "#0e1c31",
                      "lineColor": "#1c3652",
                      "lineWidth": 2,
                      "percent": false
                    }
                  ],
                  "_$child": []
                },
                {
                  "_$id": "selected_payline",
                  "_$type": "Sprite",
                  "name": "SelectedPayline",
                  "x": 0,
                  "y": 0,
                  "width": 1002,
                  "height": 240,
                  "alpha": 0.72,
                  "_gcmds": [
                    {
                      "_$type": "DrawRectCmd",
                      "x": 0,
                      "y": 118,
                      "width": 1002,
                      "height": 2,
                      "fillColor": "#7fe3d8",
                      "lineColor": null,
                      "lineWidth": 0,
                      "percent": false
                    },
                    {
                      "_$type": "DrawRectCmd",
                      "x": 0,
                      "y": 120,
                      "width": 1002,
                      "height": 1,
                      "fillColor": "#7fe3d833",
                      "lineColor": null,
                      "lineWidth": 0,
                      "percent": false
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "_$id": "machine_footer",
          "_$type": "Sprite",
          "name": "MachineFooter",
          "x": 27,
          "y": 480,
          "width": 1058,
          "height": 52,
          "_gcmds": [
            {
              "_$type": "DrawRoundRectCmd",
              "x": 0,
              "y": 0,
              "width": 1058,
              "height": 52,
              "lt": 14,
              "rt": 14,
              "lb": 14,
              "rb": 14,
              "fillColor": "#101f35",
              "lineColor": "#243e5c",
              "lineWidth": 2,
              "percent": false
            }
          ],
          "_$child": [
            {
              "_$id": "footer_label",
              "_$type": "Label",
              "name": "FooterLabel",
              "x": 22,
              "y": 10,
              "width": 420,
              "height": 26,
              "text": "WIN LINE  ·  CENTER ROW",
              "font": "Arial",
              "fontSize": 13,
              "bold": true,
              "color": "#7fe3d8",
              "align": "left",
              "valign": "middle",
              "padding": [
                1,
                0,
                0,
                0
              ]
            },
            {
              "_$id": "spin_button",
              "_$type": "Sprite",
              "name": "SpinButton",
              "x": 838,
              "y": 9,
              "width": 190,
              "height": 34,
              "_gcmds": [
                {
                  "_$type": "DrawRoundRectCmd",
                  "x": 0,
                  "y": 0,
                  "width": 190,
                  "height": 34,
                  "lt": 10,
                  "rt": 10,
                  "lb": 10,
                  "rb": 10,
                  "fillColor": "#7fe3d8",
                  "lineColor": "#a8fff2",
                  "lineWidth": 2,
                  "percent": false
                }
              ],
              "_$child": [
                {
                  "_$id": "spin_label",
                  "_$type": "Label",
                  "name": "SpinLabel",
                  "x": 0,
                  "y": 0,
                  "width": 190,
                  "height": 34,
                  "text": "SPIN  ›",
                  "font": "Arial",
                  "fontSize": 17,
                  "bold": true,
                  "color": "#06111f",
                  "align": "center",
                  "valign": "middle",
                  "padding": [
                    1,
                    0,
                    0,
                    0
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "_zhudaMeta": {
    "assetId": "assets/scenes/slot-machine.ls",
    "category": "scene-lh",
    "version": "3.4.2-zhuda-static-v1",
    "designCanvas": {
      "width": 1280,
      "height": 720,
      "padding": 0
    }
  }
}
