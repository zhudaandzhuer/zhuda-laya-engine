(function (exports, Laya) {
    'use strict';

    exports.ButtonStatus = void 0;
    (function (ButtonStatus) {
        ButtonStatus[ButtonStatus["Up"] = 0] = "Up";
        ButtonStatus[ButtonStatus["Down"] = 1] = "Down";
        ButtonStatus[ButtonStatus["Over"] = 2] = "Over";
        ButtonStatus[ButtonStatus["SelectedOver"] = 3] = "SelectedOver";
        ButtonStatus[ButtonStatus["Disabled"] = 4] = "Disabled";
        ButtonStatus[ButtonStatus["SelectedDisabled"] = 5] = "SelectedDisabled";
    })(exports.ButtonStatus || (exports.ButtonStatus = {}));
    exports.AlignType = void 0;
    (function (AlignType) {
        AlignType[AlignType["Left"] = 0] = "Left";
        AlignType[AlignType["Center"] = 1] = "Center";
        AlignType[AlignType["Right"] = 2] = "Right";
        AlignType[AlignType["None"] = 3] = "None";
    })(exports.AlignType || (exports.AlignType = {}));
    exports.VAlignType = void 0;
    (function (VAlignType) {
        VAlignType[VAlignType["Top"] = 0] = "Top";
        VAlignType[VAlignType["Middle"] = 1] = "Middle";
        VAlignType[VAlignType["Bottom"] = 2] = "Bottom";
        VAlignType[VAlignType["None"] = 3] = "None";
    })(exports.VAlignType || (exports.VAlignType = {}));
    exports.LayoutChangedReason = void 0;
    (function (LayoutChangedReason) {
        LayoutChangedReason[LayoutChangedReason["Size"] = 0] = "Size";
        LayoutChangedReason[LayoutChangedReason["Pos"] = 1] = "Pos";
        LayoutChangedReason[LayoutChangedReason["Visible"] = 2] = "Visible";
        LayoutChangedReason[LayoutChangedReason["Hierarchy"] = 3] = "Hierarchy";
    })(exports.LayoutChangedReason || (exports.LayoutChangedReason = {}));
    exports.ButtonMode = void 0;
    (function (ButtonMode) {
        ButtonMode[ButtonMode["Common"] = 0] = "Common";
        ButtonMode[ButtonMode["Check"] = 1] = "Check";
        ButtonMode[ButtonMode["Radio"] = 2] = "Radio";
    })(exports.ButtonMode || (exports.ButtonMode = {}));
    exports.ButtonDownEffect = void 0;
    (function (ButtonDownEffect) {
        ButtonDownEffect[ButtonDownEffect["None"] = 0] = "None";
        ButtonDownEffect[ButtonDownEffect["Dark"] = 1] = "Dark";
        ButtonDownEffect[ButtonDownEffect["UpScale"] = 2] = "UpScale";
        ButtonDownEffect[ButtonDownEffect["DownScale"] = 3] = "DownScale";
    })(exports.ButtonDownEffect || (exports.ButtonDownEffect = {}));
    exports.TextFitContent = void 0;
    (function (TextFitContent) {
        TextFitContent[TextFitContent["None"] = 0] = "None";
        TextFitContent[TextFitContent["Both"] = 1] = "Both";
        TextFitContent[TextFitContent["Height"] = 2] = "Height";
    })(exports.TextFitContent || (exports.TextFitContent = {}));
    exports.LayoutType = void 0;
    (function (LayoutType) {
        LayoutType[LayoutType["None"] = 0] = "None";
        LayoutType[LayoutType["SingleColumn"] = 1] = "SingleColumn";
        LayoutType[LayoutType["SingleRow"] = 2] = "SingleRow";
        LayoutType[LayoutType["FlowX"] = 3] = "FlowX";
        LayoutType[LayoutType["FlowY"] = 4] = "FlowY";
    })(exports.LayoutType || (exports.LayoutType = {}));
    exports.StretchMode = void 0;
    (function (StretchMode) {
        StretchMode[StretchMode["None"] = 0] = "None";
        StretchMode[StretchMode["Stretch"] = 1] = "Stretch";
        StretchMode[StretchMode["ResizeToFit"] = 2] = "ResizeToFit";
    })(exports.StretchMode || (exports.StretchMode = {}));
    exports.SelectionMode = void 0;
    (function (SelectionMode) {
        SelectionMode[SelectionMode["None"] = 0] = "None";
        SelectionMode[SelectionMode["Single"] = 1] = "Single";
        SelectionMode[SelectionMode["Multiple"] = 2] = "Multiple";
        SelectionMode[SelectionMode["MultipleBySingleClick"] = 3] = "MultipleBySingleClick";
        SelectionMode[SelectionMode["Disabled"] = 4] = "Disabled";
    })(exports.SelectionMode || (exports.SelectionMode = {}));
    exports.LoaderFitMode = void 0;
    (function (LoaderFitMode) {
        LoaderFitMode[LoaderFitMode["None"] = 0] = "None";
        LoaderFitMode[LoaderFitMode["Fill"] = 1] = "Fill";
        LoaderFitMode[LoaderFitMode["Contain"] = 2] = "Contain";
        LoaderFitMode[LoaderFitMode["Cover"] = 3] = "Cover";
        LoaderFitMode[LoaderFitMode["CoverWidth"] = 4] = "CoverWidth";
        LoaderFitMode[LoaderFitMode["CoverHeight"] = 5] = "CoverHeight";
    })(exports.LoaderFitMode || (exports.LoaderFitMode = {}));
    exports.ProgressTitleType = void 0;
    (function (ProgressTitleType) {
        ProgressTitleType[ProgressTitleType["Percent"] = 0] = "Percent";
        ProgressTitleType[ProgressTitleType["ValueAndMax"] = 1] = "ValueAndMax";
        ProgressTitleType[ProgressTitleType["Value"] = 2] = "Value";
        ProgressTitleType[ProgressTitleType["Max"] = 3] = "Max";
    })(exports.ProgressTitleType || (exports.ProgressTitleType = {}));
    exports.ScrollDirection = void 0;
    (function (ScrollDirection) {
        ScrollDirection[ScrollDirection["Vertical"] = 0] = "Vertical";
        ScrollDirection[ScrollDirection["Horizontal"] = 1] = "Horizontal";
        ScrollDirection[ScrollDirection["Both"] = 2] = "Both";
    })(exports.ScrollDirection || (exports.ScrollDirection = {}));
    exports.ScrollTouchEffect = void 0;
    (function (ScrollTouchEffect) {
        ScrollTouchEffect[ScrollTouchEffect["Default"] = 0] = "Default";
        ScrollTouchEffect[ScrollTouchEffect["On"] = 1] = "On";
        ScrollTouchEffect[ScrollTouchEffect["Off"] = 2] = "Off";
    })(exports.ScrollTouchEffect || (exports.ScrollTouchEffect = {}));
    exports.ScrollBounceBackEffect = void 0;
    (function (ScrollBounceBackEffect) {
        ScrollBounceBackEffect[ScrollBounceBackEffect["Default"] = 0] = "Default";
        ScrollBounceBackEffect[ScrollBounceBackEffect["On"] = 1] = "On";
        ScrollBounceBackEffect[ScrollBounceBackEffect["Off"] = 2] = "Off";
    })(exports.ScrollBounceBackEffect || (exports.ScrollBounceBackEffect = {}));
    exports.ScrollBarDisplay = void 0;
    (function (ScrollBarDisplay) {
        ScrollBarDisplay[ScrollBarDisplay["Default"] = 0] = "Default";
        ScrollBarDisplay[ScrollBarDisplay["Always"] = 1] = "Always";
        ScrollBarDisplay[ScrollBarDisplay["OnOverflow"] = 2] = "OnOverflow";
        ScrollBarDisplay[ScrollBarDisplay["OnScroll"] = 3] = "OnScroll";
        ScrollBarDisplay[ScrollBarDisplay["OnOverflowAndScroll"] = 4] = "OnOverflowAndScroll";
        ScrollBarDisplay[ScrollBarDisplay["Hidden"] = 5] = "Hidden";
    })(exports.ScrollBarDisplay || (exports.ScrollBarDisplay = {}));
    exports.PopupDirection = void 0;
    (function (PopupDirection) {
        PopupDirection[PopupDirection["Auto"] = 0] = "Auto";
        PopupDirection[PopupDirection["Up"] = 1] = "Up";
        PopupDirection[PopupDirection["Down"] = 2] = "Down";
    })(exports.PopupDirection || (exports.PopupDirection = {}));
    exports.TreeClickToExpandType = void 0;
    (function (TreeClickToExpandType) {
        TreeClickToExpandType[TreeClickToExpandType["None"] = 0] = "None";
        TreeClickToExpandType[TreeClickToExpandType["SingleClick"] = 1] = "SingleClick";
        TreeClickToExpandType[TreeClickToExpandType["DoubleClick"] = 2] = "DoubleClick";
    })(exports.TreeClickToExpandType || (exports.TreeClickToExpandType = {}));
    exports.RelationType = void 0;
    (function (RelationType) {
        RelationType[RelationType["Width"] = 1] = "Width";
        RelationType[RelationType["Height"] = 2] = "Height";
        RelationType[RelationType["Left_Left"] = 3] = "Left_Left";
        RelationType[RelationType["Left_Center"] = 4] = "Left_Center";
        RelationType[RelationType["Left_Right"] = 5] = "Left_Right";
        RelationType[RelationType["Center_Center"] = 6] = "Center_Center";
        RelationType[RelationType["Right_Left"] = 7] = "Right_Left";
        RelationType[RelationType["Right_Center"] = 8] = "Right_Center";
        RelationType[RelationType["Right_Right"] = 9] = "Right_Right";
        RelationType[RelationType["Top_Top"] = 10] = "Top_Top";
        RelationType[RelationType["Top_Middle"] = 11] = "Top_Middle";
        RelationType[RelationType["Top_Bottom"] = 12] = "Top_Bottom";
        RelationType[RelationType["Middle_Middle"] = 13] = "Middle_Middle";
        RelationType[RelationType["Bottom_Top"] = 14] = "Bottom_Top";
        RelationType[RelationType["Bottom_Middle"] = 15] = "Bottom_Middle";
        RelationType[RelationType["Bottom_Bottom"] = 16] = "Bottom_Bottom";
        RelationType[RelationType["LeftExt_Left"] = 17] = "LeftExt_Left";
        RelationType[RelationType["LeftExt_Right"] = 18] = "LeftExt_Right";
        RelationType[RelationType["RightExt_Left"] = 19] = "RightExt_Left";
        RelationType[RelationType["RightExt_Right"] = 20] = "RightExt_Right";
        RelationType[RelationType["TopExt_Top"] = 21] = "TopExt_Top";
        RelationType[RelationType["TopExt_Bottom"] = 22] = "TopExt_Bottom";
        RelationType[RelationType["BottomExt_Top"] = 23] = "BottomExt_Top";
        RelationType[RelationType["BottomExt_Bottom"] = 24] = "BottomExt_Bottom";
        RelationType[RelationType["Size"] = 100] = "Size";
        RelationType[RelationType["Pos"] = 101] = "Pos";
        RelationType[RelationType["CenterAndMiddle"] = 102] = "CenterAndMiddle";
    })(exports.RelationType || (exports.RelationType = {}));

    class Gear {
        constructor() {
            this.values = {};
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            var _a, _b, _c;
            this._owner = value;
            if (value) {
                (_a = this._controller) === null || _a === void 0 ? void 0 : _a.validate();
                this.onChanged(null);
            }
            else {
                (_b = this._controller) === null || _b === void 0 ? void 0 : _b.release();
                (_c = this._tween) === null || _c === void 0 ? void 0 : _c.kill();
            }
        }
        get controller() {
            return this._controller;
        }
        set controller(value) {
            if (this._controller)
                this._controller.release();
            this._controller = value;
            if (value) {
                value.onChanged = sender => this.onChanged(sender);
                if (this._owner)
                    value.validate();
            }
        }
        get propPath() {
            return this._propPath;
        }
        set propPath(value) {
            this._propPath = value;
            this._propPathArr = value ? value.split(".") : null;
            this.onChanged(null);
        }
        get tween() {
            return this._tweenCfg;
        }
        set tween(value) {
            this._tweenCfg = value;
        }
        onChanged(initiator) {
            if (this._owner && this._controller)
                this.runGear(initiator);
        }
        getValue(page) {
            let value = this.values[page];
            if (value === undefined && page != 0) {
                value = this.values[0];
                if (value != null && typeof (value) === "object" && typeof value.clone === "function")
                    value = value.clone();
            }
            return value;
        }
        compareValue(value, value2) {
            if (value != null && typeof (value) === "object" && typeof value.equal === "function") {
                if (value.equal(value2))
                    return true;
            }
            else if (value == value2)
                return true;
            return false;
        }
        doTween(obj, key, oldValue, newValue) {
            if (this._tween) {
                let tweener = this._tween.findTweener(null);
                if (tweener && this.compareValue(newValue, tweener.endValue.getAt(0)))
                    return;
                this._tween.kill();
                this._tween.recover();
                this._tween = null;
            }
            if (this.compareValue(oldValue, newValue))
                return;
            let tc = this._tweenCfg;
            this._tween = Laya.Tween.create(obj, this._owner)
                .duration(tc.duration)
                .delay(tc.delay)
                .ease(Laya.Ease[tc.easeType])
                .go(key, oldValue, newValue)
                .then(() => {
                this._tween.recover();
                this._tween = null;
            });
            if (obj.cmdID)
                this._tween.onUpdate(() => { var _a; return (_a = this._owner._graphics) === null || _a === void 0 ? void 0 : _a.repaint(); });
        }
        runGear(initiator) {
            var _a;
            let arr = this._propPathArr;
            if (!arr)
                return;
            let obj = this._owner;
            let cnt = arr.length;
            for (let i = 0; i < cnt - 1; i++) {
                obj = obj[arr[i]];
                if (obj == null)
                    return;
            }
            let key = arr[cnt - 1];
            if (this.values[0] === undefined)
                this.values[0] = obj[key];
            let newValue = this.getValue(this._controller.selectedIndex);
            if (newValue === undefined)
                return;
            let oldValue = obj[key];
            if (oldValue == null
                || !this._tweenCfg || !this._tweenCfg.enabled
                || !initiator || !initiator.changing
                || Gear.disableAllTweenEffect
                || this._owner._getBit(Laya.NodeFlags.EDITING_NODE)) {
                obj[key] = newValue;
                if (obj.cmdID)
                    (_a = this._owner._graphics) === null || _a === void 0 ? void 0 : _a.repaint();
                return;
            }
            this.doTween(obj, key, oldValue, newValue);
        }
    }
    Gear.disableAllTweenEffect = false;
    class GearNumber extends Gear {
    }
    class GearString extends Gear {
    }
    class GearBool extends Gear {
    }
    class GearColor extends Gear {
    }
    class GearStrColor extends Gear {
        doTween(obj, key, oldValue, newValue) {
            super.doTween(obj, key, oldValue, newValue);
            this._tween && this._tween.interp(Laya.Tween.seperateChannel);
        }
    }
    class GearHexColor extends Gear {
        doTween(obj, key, oldValue, newValue) {
            super.doTween(obj, key, oldValue, newValue);
            this._tween && this._tween.interp(Laya.Tween.seperateChannel, 4);
        }
    }

    class GearDisplay extends Gear {
        constructor() {
            super();
            this._flag = true;
            this._condition = 0;
            this._pages = [];
            this.propPath = "internalVisible";
        }
        get pages() {
            return this._pages;
        }
        set pages(value) {
            this._pages = value;
            this.onChanged(null);
        }
        get condition() {
            return this._condition;
        }
        set condition(value) {
            this._condition = value;
            this.onChanged(null);
        }
        runGear(initiator) {
            if (this._tween) {
                this._tween.kill();
                this._tween.recover();
                this._tween = null;
            }
            let page = this._controller.selectedIndex;
            this._flag = page == -1 || this._pages.length == 0 || this._pages.indexOf(page) != -1;
            if (initiator == null || !initiator.changing || this._owner.gears.length === 1)
                GearDisplay.check(this._owner, null, false);
            else
                pendings.add(this._owner);
        }
        static check(owner, cc, allowDelay) {
            var _a, _b;
            let r;
            let delay = 0;
            let gd;
            for (let g of owner.gears) {
                if (g instanceof GearDisplay) {
                    if (r == null)
                        r = g._flag;
                    else if (g._condition == 0)
                        r = r && g._flag;
                    else
                        r = r || g._flag;
                    gd = g;
                }
                else if (allowDelay && g._tween != null && ((_a = g.controller) === null || _a === void 0 ? void 0 : _a.inst) == cc) {
                    delay = Math.max(delay, (_b = g._tween.findTweener(null)) === null || _b === void 0 ? void 0 : _b.remainTime);
                }
            }
            r = r !== null && r !== void 0 ? r : true;
            if (delay !== 0 && !r && owner.internalVisible != r) {
                gd._tween = Laya.Tween.create(owner).duration(delay).then(() => {
                    owner.internalVisible = false;
                    gd._tween.recover();
                    gd._tween = null;
                });
            }
            else
                owner.internalVisible = r;
        }
        static checkAll(cc) {
            if (pendings.size == 0)
                return;
            for (let obj of pendings) {
                GearDisplay.check(obj, cc, true);
            }
            pendings.clear();
        }
    }
    const pendings = new Set();

    class Controller extends Laya.EventDispatcher {
        constructor() {
            super();
            this.name = "";
            this._pages = [];
            this._selectedIndex = -1;
            this._previousIndex = -1;
            this._refs = new Set();
        }
        get pages() {
            return this._pages;
        }
        set pages(value) {
            this._pages = value;
            if (value.length > 0 && this._selectedIndex == -1)
                this.selectedIndex = 0;
        }
        get numPages() {
            return this._pages.length;
        }
        set numPages(value) {
            this._pages.length = value;
            for (let i = 0; i < value; i++)
                if (this._pages[i] == null)
                    this._pages[i] = "";
        }
        addPage(name) {
            name = name || "";
            this._pages.push(name);
            if (this._selectedIndex == -1)
                this.selectedIndex = 0;
            return this;
        }
        get selectedIndex() {
            return this._selectedIndex;
        }
        set selectedIndex(value) {
            if (this._pages.length == 0)
                return;
            if (this._selectedIndex != value) {
                if (value > this._pages.length - 1) {
                    console.warn(`index out of bounds: ${value}`);
                    return;
                }
                this._previousIndex = this._selectedIndex;
                this._selectedIndex = value;
                this.changing = true;
                try {
                    for (let ref of this._refs) {
                        ref.onChanged(this);
                    }
                    GearDisplay.checkAll(this);
                    this.event(Laya.Event.CHANGED);
                }
                finally {
                    this.changing = false;
                }
            }
        }
        get selectedPage() {
            if (this._selectedIndex < 0 || this._selectedIndex >= this._pages.length)
                return null;
            else
                return this._pages[this._selectedIndex];
        }
        set selectedPage(value) {
            let i = this._pages.indexOf(value);
            if (i === -1)
                i = 0;
            this.selectedIndex = i;
        }
        get previousIndex() {
            return this._previousIndex;
        }
        set oppositeIndex(value) {
            if (value > 0)
                this.selectedIndex = 0;
            else if (this._pages.length > 1)
                this.selectedIndex = 1;
        }
    }

    exports.UIEvent = void 0;
    (function (UIEvent) {
        UIEvent["ContentSizeChanged"] = "content_size_changed";
        UIEvent["ControllersChanged"] = "controllers_changed";
        UIEvent["Scroll"] = "scroll";
        UIEvent["ScrollEnd"] = "scroll_end";
        UIEvent["PullDownRelease"] = "pull_down_release";
        UIEvent["PullUpRelease"] = "pull_up_release";
        UIEvent["ClickItem"] = "click_item";
        UIEvent["Popup"] = "popup";
        UIEvent["InstanceReload"] = "instance_reload";
    })(exports.UIEvent || (exports.UIEvent = {}));

    class ControllerRef {
        constructor(target, name) {
            if (arguments.length == 2) {
                this._target = target;
                this._name = name || "";
            }
            else {
                this._target = target.owner;
                this._name = target.name;
            }
            this._inst = null;
        }
        get target() {
            return this._target;
        }
        get name() {
            return this._name;
        }
        get inst() {
            return this._inst;
        }
        get selectedIndex() {
            return this._inst ? this._inst.selectedIndex : -1;
        }
        set selectedIndex(value) {
            if (this._inst)
                this._inst.selectedIndex = value;
        }
        get selectedPage() {
            return this._inst ? this._inst.selectedPage : "";
        }
        set selectedPage(value) {
            if (this._inst)
                this._inst.selectedPage = value;
        }
        get previousIndex() {
            return this._inst ? this._inst.selectedIndex : 0;
        }
        set oppositeIndex(value) {
            if (this._inst)
                this._inst.oppositeIndex = value;
        }
        release() {
            if (this._inited) {
                this._inited = false;
                this._target.off(exports.UIEvent.ControllersChanged, this, this._check);
                if (!Laya.LayaEnv.isPlaying)
                    this._target.off(exports.UIEvent.InstanceReload, this, this._reload);
                if (this._inst) {
                    this._inst._refs.delete(this);
                    this._inst = null;
                }
            }
        }
        validate() {
            if (!this._inited) {
                this._inited = true;
                this._target.on(exports.UIEvent.ControllersChanged, this, this._check);
                if (!Laya.LayaEnv.isPlaying)
                    this._target.on(exports.UIEvent.InstanceReload, this, this._reload);
                this._check(true);
            }
        }
        _reload(newIns) {
            this._target = newIns;
            this._check();
        }
        _check(noEmit) {
            let c = this._target.getController(this._name);
            if (c != this._inst) {
                if (this._inst)
                    this._inst._refs.delete(this);
                this._inst = c;
                if (c)
                    this._inst._refs.add(this);
                if (!noEmit)
                    this.onChanged(c);
            }
        }
    }

    class UIConfig2 {
    }
    UIConfig2.modalLayerColor = "rgba(50, 50, 50, 0.2)";
    UIConfig2.horizontalScrollBar = null;
    UIConfig2.verticalScrollBar = null;
    UIConfig2.defaultScrollStep = 25;
    UIConfig2.defaultScrollDecelerationRate = 0.967;
    UIConfig2.defaultScrollBarDisplay = exports.ScrollBarDisplay.Always;
    UIConfig2.defaultScrollTouchEffect = true;
    UIConfig2.defaultScrollBounceEffect = true;
    UIConfig2.defaultScrollSnappingThreshold = 0.1;
    UIConfig2.defaultScrollPagingThreshold = 0.3;
    UIConfig2.popupMenu = null;
    UIConfig2.popupMenuSeperator = null;
    UIConfig2.tooltipsWidget = null;
    UIConfig2.defaultTooltipsShowDelay = 100;
    UIConfig2.defaultComboBoxVisibleItemCount = 20;
    UIConfig2.touchScrollSensitivity = 10;
    UIConfig2.touchDragSensitivity = 10;
    UIConfig2.clickDragSensitivity = 2;
    UIConfig2.bringWindowToFrontOnClick = true;

    const handlingFlag = Symbol();
    class Relation {
        constructor() {
            this._data = [];
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            this._owner = value;
            if (this._target) {
                if (this._owner)
                    this.setTarget();
                else
                    this.unsetTarget();
            }
        }
        set target(value) {
            if (this._target != value) {
                if (this._target)
                    this.unsetTarget();
                this._target = value;
                if (this._owner && this._target)
                    this.setTarget();
            }
        }
        get target() {
            return this._target;
        }
        get data() {
            return this._data;
        }
        set data(value) {
            this._data = value;
        }
        add(type, percent) {
            if (type == exports.RelationType.Size) {
                this.add(exports.RelationType.Width, percent);
                this.add(exports.RelationType.Height, percent);
                return;
            }
            else if (type == exports.RelationType.Pos) {
                this.add(exports.RelationType.Left_Left, percent);
                this.add(exports.RelationType.Top_Top, percent);
                return;
            }
            else if (type == exports.RelationType.CenterAndMiddle) {
                this.add(exports.RelationType.Center_Center, percent);
                this.add(exports.RelationType.Middle_Middle, percent);
                return;
            }
            if (this._data.findIndex((v, i) => v == type && (i % 2) == 0) == -1)
                this._data.push(type, percent ? 1 : 0);
        }
        remove(type) {
            if (type == exports.RelationType.Size) {
                this.remove(exports.RelationType.Width);
                this.remove(exports.RelationType.Height);
                return;
            }
            for (let i = 0, n = this._data.length; i < n; i += 2) {
                if (this._data[i] == type) {
                    this._data.splice(i, 2);
                    break;
                }
            }
        }
        setTarget() {
            let t = this._target;
            this._tx = t.x;
            this._ty = t.y;
            this._tw = t.width;
            this._th = t.height;
            t.on(Laya.Event.MOVED, this, this.posChanged);
            t.on(Laya.Event.RESIZE, this, this.sizeChanged);
            if (!Laya.LayaEnv.isPlaying)
                t.on(exports.UIEvent.InstanceReload, this, this.instReload);
        }
        unsetTarget() {
            this._target.off(Laya.Event.MOVED, this, this.posChanged);
            this._target.off(Laya.Event.RESIZE, this, this.sizeChanged);
            if (!Laya.LayaEnv.isPlaying)
                this._target.off(exports.UIEvent.InstanceReload, this, this.instReload);
        }
        applyOnSelfResized() {
            if (this._data.length == 0)
                return;
            for (let i = 0, n = this._data.length; i < n; i += 2) {
                switch (this._data[i]) {
                    case exports.RelationType.Center_Center:
                        this._owner.x -= (0.5 - this._owner.anchorX) * this._owner._deltaWidth;
                        break;
                    case exports.RelationType.Right_Center:
                    case exports.RelationType.Right_Left:
                    case exports.RelationType.Right_Right:
                        this._owner.x -= (1 - this._owner.anchorX) * this._owner._deltaWidth;
                        break;
                    case exports.RelationType.Middle_Middle:
                        this._owner.y -= (0.5 - this._owner.anchorY) * this._owner._deltaHeight;
                        break;
                    case exports.RelationType.Bottom_Middle:
                    case exports.RelationType.Bottom_Top:
                    case exports.RelationType.Bottom_Bottom:
                        this._owner.y -= (1 - this._owner.anchorY) * this._owner._deltaHeight;
                        break;
                }
            }
        }
        applyOnPosChanged(type, dx, dy) {
            let tmp;
            switch (type) {
                case exports.RelationType.Left_Left:
                case exports.RelationType.Left_Center:
                case exports.RelationType.Left_Right:
                case exports.RelationType.Center_Center:
                case exports.RelationType.Right_Left:
                case exports.RelationType.Right_Center:
                case exports.RelationType.Right_Right:
                    this._owner.x += dx;
                    break;
                case exports.RelationType.Top_Top:
                case exports.RelationType.Top_Middle:
                case exports.RelationType.Top_Bottom:
                case exports.RelationType.Middle_Middle:
                case exports.RelationType.Bottom_Top:
                case exports.RelationType.Bottom_Middle:
                case exports.RelationType.Bottom_Bottom:
                    this._owner.y += dy;
                    break;
                case exports.RelationType.Width:
                case exports.RelationType.Height:
                    break;
                case exports.RelationType.LeftExt_Left:
                case exports.RelationType.LeftExt_Right:
                    tmp = this._owner.left;
                    this._owner.width = this._owner._rawWidth - dx;
                    this._owner.left = tmp + dx;
                    break;
                case exports.RelationType.RightExt_Left:
                case exports.RelationType.RightExt_Right:
                    tmp = this._owner.left;
                    this._owner.width = this._owner._rawWidth + dx;
                    this._owner.left = tmp;
                    break;
                case exports.RelationType.TopExt_Top:
                case exports.RelationType.TopExt_Bottom:
                    tmp = this._owner.top;
                    this._owner.height = this._owner._rawHeight - dy;
                    this._owner.top = tmp + dy;
                    break;
                case exports.RelationType.BottomExt_Top:
                case exports.RelationType.BottomExt_Bottom:
                    tmp = this._owner.top;
                    this._owner.height = this._owner._rawHeight + dy;
                    this._owner.top = tmp;
                    break;
            }
        }
        applyOnSizeChanged(ow, type, percent, tw, th, isAncestor) {
            let pos = 0, anchor = 0, delta = 0;
            let v, tmp;
            let rw, rh;
            if (hRelations[type]) {
                if (!isAncestor) {
                    pos = this._target.x;
                    anchor = this._target.anchorX;
                }
                if (percent) {
                    if (this._tw != 0)
                        delta = tw / this._tw;
                }
                else
                    delta = tw - this._tw;
            }
            else {
                if (!isAncestor) {
                    pos = this._target.y;
                    anchor = this._target.anchorY;
                }
                if (percent) {
                    if (this._th != 0)
                        delta = th / this._th;
                }
                else
                    delta = th - this._th;
            }
            switch (type) {
                case exports.RelationType.Left_Left:
                    if (percent)
                        ow.left = pos + (ow.left - pos) * delta;
                    else if (anchor != 0)
                        ow.x += delta * (-anchor);
                    break;
                case exports.RelationType.Left_Center:
                    if (percent)
                        ow.left = pos + (ow.left - pos) * delta;
                    else
                        ow.x += delta * (0.5 - anchor);
                    break;
                case exports.RelationType.Left_Right:
                    if (percent)
                        ow.left = pos + (ow.left - pos) * delta;
                    else
                        ow.x += delta * (1 - anchor);
                    break;
                case exports.RelationType.Center_Center:
                    if (percent)
                        ow.left = pos + (ow.left + ow._rawWidth * 0.5 - pos) * delta - ow._rawWidth * 0.5;
                    else
                        ow.x += delta * (0.5 - anchor);
                    break;
                case exports.RelationType.Right_Left:
                    if (percent)
                        ow.left = pos + (ow.left + ow._rawWidth - pos) * delta - ow._rawWidth;
                    else if (anchor != 0)
                        ow.x += delta * (-anchor);
                    break;
                case exports.RelationType.Right_Center:
                    if (percent)
                        ow.left = pos + (ow.left + ow._rawWidth - pos) * delta - ow._rawWidth;
                    else
                        ow.x += delta * (0.5 - anchor);
                    break;
                case exports.RelationType.Right_Right:
                    if (percent)
                        ow.left = pos + (ow.left + ow._rawWidth - pos) * delta - ow._rawWidth;
                    else
                        ow.x += delta * (1 - anchor);
                    break;
                case exports.RelationType.Top_Top:
                    if (percent)
                        ow.top = pos + (ow.top - pos) * delta;
                    else if (anchor != 0)
                        ow.y += delta * (-anchor);
                    break;
                case exports.RelationType.Top_Middle:
                    if (percent)
                        ow.top = pos + (ow.top - pos) * delta;
                    else
                        ow.y += delta * (0.5 - anchor);
                    break;
                case exports.RelationType.Top_Bottom:
                    if (percent)
                        ow.top = pos + (ow.top - pos) * delta;
                    else
                        ow.y += delta * (1 - anchor);
                    break;
                case exports.RelationType.Middle_Middle:
                    if (percent)
                        ow.top = pos + (ow.top + ow._rawHeight * 0.5 - pos) * delta - ow._rawHeight * 0.5;
                    else
                        ow.y += delta * (0.5 - anchor);
                    break;
                case exports.RelationType.Bottom_Top:
                    if (percent)
                        ow.top = pos + (ow.top + ow._rawHeight - pos) * delta - ow._rawHeight;
                    else if (anchor != 0)
                        ow.y += delta * (-anchor);
                    break;
                case exports.RelationType.Bottom_Middle:
                    if (percent)
                        ow.top = pos + (ow.top + ow._rawHeight - pos) * delta - ow._rawHeight;
                    else
                        ow.y += delta * (0.5 - anchor);
                    break;
                case exports.RelationType.Bottom_Bottom:
                    if (percent)
                        ow.top = pos + (ow.top + ow._rawHeight - pos) * delta - ow._rawHeight;
                    else
                        ow.y += delta * (1 - anchor);
                    break;
                case exports.RelationType.Width:
                    if (ow._deltaWidth != 0)
                        break;
                    if (this._sw != null) {
                        v = this._sw - this._tw;
                        this._sw = null;
                    }
                    else
                        v = ow._rawWidth - this._tw;
                    if (percent)
                        v = v * delta;
                    if (isAncestor) {
                        tmp = ow.left;
                        ow.size(tw + v, ow._rawHeight);
                        ow.left = tmp;
                    }
                    else
                        ow.width = tw + v;
                    break;
                case exports.RelationType.Height:
                    if (ow._deltaHeight != 0)
                        break;
                    if (this._sh != null) {
                        v = this._sh - this._th;
                        this._sh = null;
                    }
                    else
                        v = ow._rawHeight - this._th;
                    if (percent)
                        v = v * delta;
                    if (isAncestor) {
                        tmp = ow.top;
                        ow.size(ow._rawWidth, th + v);
                        ow.top = tmp;
                    }
                    else
                        ow.height = th + v;
                    break;
                case exports.RelationType.LeftExt_Left:
                    tmp = ow.left;
                    if (percent)
                        v = pos + (tmp - pos) * delta - tmp;
                    else
                        v = delta * (-anchor);
                    ow.width = ow._rawWidth - v;
                    ow.left = tmp + v;
                    break;
                case exports.RelationType.LeftExt_Right:
                    tmp = ow.left;
                    if (percent)
                        v = pos + (tmp - pos) * delta - tmp;
                    else
                        v = delta * (1 - anchor);
                    ow.width = ow._rawWidth - v;
                    ow.left = tmp + v;
                    break;
                case exports.RelationType.RightExt_Left:
                    tmp = ow.left;
                    if (percent)
                        v = pos + (tmp + ow._rawWidth - pos) * delta - (tmp + ow._rawWidth);
                    else
                        v = delta * (-anchor);
                    ow.width = ow._rawWidth + v;
                    ow.left = tmp;
                    break;
                case exports.RelationType.RightExt_Right:
                    if (ow._deltaWidth != 0)
                        break;
                    tmp = ow.left;
                    rw = ow._rawWidth;
                    if (this._sw != null) {
                        rw = this._sw;
                        this._sw = null;
                    }
                    if (percent) {
                        v = pos + (tmp + rw - pos) * delta - (tmp + rw);
                        ow.width = rw + v;
                        ow.left = tmp;
                    }
                    else {
                        v = delta * (1 - anchor);
                        ow.width = rw + v;
                        ow.left = tmp;
                    }
                    break;
                case exports.RelationType.TopExt_Top:
                    tmp = ow.top;
                    if (percent)
                        v = pos + (tmp - pos) * delta - tmp;
                    else
                        v = delta * (-anchor);
                    ow.height = ow._rawHeight - v;
                    ow.top = tmp + v;
                    break;
                case exports.RelationType.TopExt_Bottom:
                    tmp = ow.top;
                    if (percent)
                        v = pos + (tmp - pos) * delta - tmp;
                    else
                        v = delta * (1 - anchor);
                    ow.height = ow._rawHeight - v;
                    ow.top = tmp + v;
                    break;
                case exports.RelationType.BottomExt_Top:
                    tmp = ow.top;
                    if (percent)
                        v = pos + (tmp + ow._rawHeight - pos) * delta - (tmp + ow._rawHeight);
                    else
                        v = delta * (-anchor);
                    ow.height = ow._rawHeight + v;
                    ow.top = tmp;
                    break;
                case exports.RelationType.BottomExt_Bottom:
                    if (ow._deltaHeight != 0)
                        break;
                    tmp = ow.top;
                    rh = ow._rawHeight;
                    if (this._sh != null) {
                        rh = this._sh;
                        this._sh = null;
                    }
                    if (percent) {
                        v = pos + (tmp + rh - pos) * delta - (tmp + rh);
                        ow.height = rh + v;
                        ow.top = tmp;
                    }
                    else {
                        v = delta * (1 - anchor);
                        ow.height = rh + v;
                        ow.top = tmp;
                    }
                    break;
            }
        }
        posChanged() {
            if (!this._owner || this._owner[handlingFlag] || this._isDisabled) {
                this._tx = this._target.x;
                this._ty = this._target.y;
                return;
            }
            if (this._target.isAncestorOf(this._owner))
                return;
            let tmp = Laya.SerializeUtil.isDeserializing;
            if (tmp)
                Laya.SerializeUtil.isDeserializing = false;
            this._owner[handlingFlag] = true;
            let dx = this._target.x - this._tx;
            let dy = this._target.y - this._ty;
            for (let i = 0, n = this._data.length; i < n; i += 2)
                this.applyOnPosChanged(this._data[i], dx, dy);
            this._owner[handlingFlag] = false;
            if (tmp)
                Laya.SerializeUtil.isDeserializing = true;
            this._tx = this._target.x;
            this._ty = this._target.y;
        }
        sizeChanged() {
            let tw = this._target.width, th = this._target.height;
            let ow = this._owner;
            if (!ow || ow[handlingFlag] || this._isDisabled) {
                this._tw = tw;
                this._th = th;
                return;
            }
            let isAncestor = this._target.isAncestorOf(ow);
            let tmp = Laya.SerializeUtil.isDeserializing;
            if (tmp)
                Laya.SerializeUtil.isDeserializing = false;
            ow[handlingFlag] = true;
            for (let i = 0, n = this._data.length; i < n; i += 2)
                this.applyOnSizeChanged(ow, this._data[i], this._data[i + 1] == 1, tw, th, isAncestor);
            ow[handlingFlag] = false;
            if (tmp)
                Laya.SerializeUtil.isDeserializing = true;
            this._tw = tw;
            this._th = th;
        }
        instReload(newIns) {
            this.target = newIns;
        }
    }
    const hRelations = [];
    (function () {
        const arr = [
            exports.RelationType.Width,
            exports.RelationType.Left_Left,
            exports.RelationType.Left_Center,
            exports.RelationType.Left_Right,
            exports.RelationType.Center_Center,
            exports.RelationType.Right_Left,
            exports.RelationType.Right_Center,
            exports.RelationType.Right_Right,
            exports.RelationType.LeftExt_Left,
            exports.RelationType.LeftExt_Right,
            exports.RelationType.RightExt_Left,
            exports.RelationType.RightExt_Right
        ];
        for (let i of arr)
            hRelations[i] = true;
    })();

    class GWidget extends Laya.Sprite {
        constructor() {
            super();
            this._grayed = false;
            this._draggable = false;
            this._rawWidth = 0;
            this._rawHeight = 0;
            this._deltaWidth = 0;
            this._deltaHeight = 0;
            this._giveWidth = 0;
            this._giveHeight = 0;
            this.sourceWidth = 0;
            this.sourceHeight = 0;
            this._nodeType = 2;
            this._controllers = {};
            this._gears = [];
            this._relations = [];
            this._controllerCount = 0;
            this._initialize();
        }
        get left() {
            return this._x - this._width * this._anchorX;
        }
        set left(value) {
            this.pos(value + this._width * this._anchorX, this.y);
        }
        get top() {
            return this._y - this._height * this._anchorY;
        }
        set top(value) {
            this.pos(this._x, value + this._height * this._anchorY);
        }
        setLeftTop(xv, yv) {
            xv = xv != null ? xv + this._width * this._anchorX : this._x;
            yv = yv != null ? yv + this._height * this._anchorY : this._y;
            this.pos(xv, yv);
        }
        center(target) {
            let r = target;
            if (!r) {
                if (this.parent)
                    r = this.parent;
                else
                    r = GWidget._defaultRoot;
            }
            this.setLeftTop(Math.floor((r.width - this.width) * 0.5), Math.floor((r.height - this.height) * 0.5));
            return this;
        }
        pos(x, y) {
            var _a, _b, _c;
            if (this._x != x || this._y != y) {
                super.pos(x, y);
                if (((_a = this.parent) === null || _a === void 0 ? void 0 : _a._nodeType) == 2)
                    (_c = (_b = this.parent).setLayoutChangedFlag) === null || _c === void 0 ? void 0 : _c.call(_b, exports.LayoutChangedReason.Pos);
                this.event(Laya.Event.MOVED);
            }
            return this;
        }
        size(wv, hv, changeByLayout) {
            var _a;
            if (this._width == wv && this._height == hv) {
                if (this._forceSizeFlag)
                    this._forceSizeFlag = false;
                else
                    return this;
            }
            this._rawWidth = wv;
            this._rawHeight = hv;
            if (!changeByLayout) {
                this._giveWidth = wv;
                this._giveHeight = hv;
            }
            if (wv < 0)
                wv = 0;
            if (hv < 0)
                hv = 0;
            this._deltaWidth = wv - this._width;
            this._deltaHeight = hv - this._height;
            super.size(wv, hv);
            this.setLayoutChangedFlag();
            this._sizeChanged(changeByLayout);
            if (this.parent) {
                if (this._relations.length > 0) {
                    for (let item of this._relations)
                        item.applyOnSelfResized();
                }
                if (((_a = this.parent) === null || _a === void 0 ? void 0 : _a._nodeType) == 2)
                    this.parent.setLayoutChangedFlag(exports.LayoutChangedReason.Size);
            }
            this.event(Laya.Event.RESIZE);
            this._deltaWidth = 0;
            this._deltaHeight = 0;
            return this;
        }
        makeFullSize(target, constraints) {
            let r = target;
            if (!r) {
                if (this.parent instanceof GWidget)
                    r = this.parent;
                else
                    r = GWidget._defaultRoot;
            }
            this.size(r.width, r.height);
            if (constraints)
                this.addRelation(r, exports.RelationType.Size);
            return this;
        }
        get grayed() {
            return this._grayed;
        }
        set grayed(value) {
            value = !!value;
            if (this._grayed !== value) {
                this._grayed = value;
                let c = this.getController("grayed");
                if (c) {
                    c.selectedIndex = value ? 1 : 0;
                    value = false;
                }
                let postProcess = this.getPostProcess(value);
                if (value) {
                    let effect = postProcess.getEffect(Laya.GrayscaleEffect2D);
                    if (!effect)
                        effect = postProcess.addEffect(new Laya.GrayscaleEffect2D());
                }
                else {
                    if (postProcess) {
                        let effect = postProcess.getEffect(Laya.GrayscaleEffect2D);
                        if (effect) {
                            postProcess.removeEffect(effect);
                            if (!Laya.LayaEnv.isPlaying && postProcess.effects.length === 0)
                                this.postProcess = null;
                        }
                    }
                }
            }
        }
        get enabled() {
            return !this.grayed && this.mouseEnabled;
        }
        set enabled(value) {
            this.grayed = !value;
            this.mouseEnabled = value;
        }
        get internalVisible() {
            return !this._getBit(Laya.NodeFlags.NOT_IN_PAGE);
        }
        set internalVisible(value) {
            var _a;
            if (((this._bits & Laya.NodeFlags.NOT_IN_PAGE) === 0) !== value) {
                this._setBit(Laya.NodeFlags.NOT_IN_PAGE, !value);
                this._processVisible();
                if (((_a = this._parent) === null || _a === void 0 ? void 0 : _a.activeInHierarchy) && this.active)
                    this._processActive(value, true);
            }
        }
        get tooltips() {
            return this._tooltips;
        }
        set tooltips(value) {
            if (this._tooltips) {
                this.off(Laya.Event.ROLL_OVER, this, this._rollOver);
                this.off(Laya.Event.ROLL_OUT, this, this._rollOut);
            }
            this._tooltips = value;
            if (this._tooltips) {
                this.on(Laya.Event.ROLL_OVER, this, this._rollOver);
                this.on(Laya.Event.ROLL_OUT, this, this._rollOut);
            }
        }
        _rollOver() {
            GWidget._defaultRoot.popupMgr.showTooltips(this._tooltips, UIConfig2.defaultTooltipsShowDelay);
        }
        _rollOut() {
            GWidget._defaultRoot.popupMgr.hideTooltips();
        }
        get text() {
            return "";
        }
        set text(value) {
        }
        get icon() {
            return null;
        }
        set icon(value) {
        }
        get background() {
            return this._background;
        }
        set background(value) {
            if (this._background)
                this.graphics.removeCmd(this._background, true);
            this._background = value;
            if (value) {
                value.lock = true;
                this.graphics.addCmd(value, 0);
            }
        }
        get draggable() {
            return this._draggable;
        }
        set draggable(value) {
            if (this._draggable != value) {
                this._draggable = value;
                if (value) {
                    if (!this._dragSupport)
                        this._dragSupport = new Laya.DragSupport(this);
                }
                if (this._dragSupport)
                    this._dragSupport.autoStart = value;
            }
        }
        get relations() {
            return this._relations;
        }
        set relations(value) {
            if (this._relations.length > 0)
                this._relations.filter(g => !value.includes(g)).forEach(g => g.owner = null);
            this._relations = value;
            value.forEach(g => g.owner = this);
        }
        _addRelations(value) {
            for (let v of value) {
                v.owner = this;
                this._relations.push(v);
            }
        }
        addRelation(target, type, percent) {
            let item = this._relations.find(i => i.target == target);
            if (!item) {
                item = new Relation();
                item.owner = this;
                item.target = target;
                this._relations.push(item);
            }
            item.add(type, percent);
            return this;
        }
        removeRelation(target, type) {
            let item = this._relations.find(i => i.target == target);
            if (item)
                item.remove(type);
            return this;
        }
        clearRelations() {
            this._relations.length = 0;
            return this;
        }
        get controllers() {
            return this._controllers;
        }
        get controllerCount() {
            return this._controllerCount;
        }
        set controllers(value) {
            this._controllers = value;
            let i = 0;
            for (let k in value) {
                value[k].name = k;
                value[k].owner = this;
                i++;
            }
            this._controllerCount = i;
            this._controllersChanged();
        }
        addController(name, pageCount) {
            if (this._controllers[name]) {
                console.warn(`controller ${name} already exists`);
                return this._controllers[name];
            }
            let c = new Controller();
            c.name = name;
            c.owner = this;
            if (pageCount != null)
                c.numPages = pageCount;
            this._controllers[name] = c;
            this._controllerCount++;
            this._controllersChanged();
            return c;
        }
        getController(name) {
            return this._controllers[name];
        }
        setPage(controllerName, page) {
            let c = this._controllers[controllerName];
            if (!c)
                return;
            if (typeof (page) === "number")
                c.selectedIndex = page;
            else
                c.selectedPage = page;
        }
        _controllersChanged() {
            this.event(exports.UIEvent.ControllersChanged);
        }
        get gears() {
            return this._gears;
        }
        set gears(value) {
            let visChanged;
            if (this._gears.length > 0) {
                this._gears.filter(g => !value.includes(g)).forEach(g => {
                    if (g instanceof GearDisplay)
                        visChanged = true;
                    g.owner = null;
                });
            }
            this._gears = value;
            value.forEach(g => g.owner = this);
            if (visChanged)
                GearDisplay.check(this);
        }
        _addGears(value) {
            this._gears.push(...value);
            value.forEach(g => g.owner = this);
        }
        addGear(value) {
            this._gears.push(value);
            value.owner = this;
        }
        removeGear(value) {
            let i = this._gears.indexOf(value);
            if (i != -1) {
                this._gears.splice(i, 1);
                value.owner = null;
            }
        }
        onClick(caller, listener, args) {
            if (arguments.length == 1) {
                listener = caller;
                caller = null;
            }
            this.on(Laya.Event.CLICK, caller, listener, args);
        }
        offClick(caller, listener) {
            if (arguments.length == 1) {
                listener = caller;
                caller = null;
            }
            this.off(Laya.Event.CLICK, caller, listener);
        }
        destroy() {
            if (this._background)
                this._background.lock = false;
            super.destroy();
            for (let k in this._controllers)
                this._controllers[k].offAll();
            for (let g of this._gears)
                g.owner = null;
        }
        _sizeChanged(changeByLayout) {
        }
        _childChanged(child) {
            super._childChanged(child);
            this.setLayoutChangedFlag(exports.LayoutChangedReason.Hierarchy);
        }
        _processVisible(parentVisible) {
            var _a, _b, _c;
            if (super._processVisible(parentVisible)) {
                if (((_a = this.parent) === null || _a === void 0 ? void 0 : _a._nodeType) == 2)
                    (_c = (_b = this.parent).setLayoutChangedFlag) === null || _c === void 0 ? void 0 : _c.call(_b, exports.LayoutChangedReason.Visible);
                return true;
            }
            else
                return false;
        }
        setLayoutChangedFlag(reason) {
        }
        _onConstruct(inPrefab) {
            if (inPrefab && this._relations.length > 0) {
                for (let r of this._relations) {
                    r._sw = this._width;
                    r._sh = this._height;
                    if (r.target)
                        r.target._forceSizeFlag = true;
                }
            }
            this.onConstruct();
        }
        onConstruct() {
        }
        onAfterDeserialize() {
            super.onAfterDeserialize();
            if (Laya.SerializeUtil.hasProp("_startPages")) {
                let col = this._startPages;
                if (col) {
                    for (let k in col) {
                        let c = this.getController(k);
                        if (c)
                            c.selectedIndex = col[k];
                    }
                }
            }
        }
    }

    class ImageRenderer {
        constructor(owner) {
            this._owner = owner;
            this._color = new Laya.Color();
        }
        destroy() {
            if (this._tex) {
                this._tex.off("reload", this, this.onTextureReload);
                this._tex = null;
            }
            if (this._drawCmd) {
                this._drawCmd.lock = false;
                this._drawCmd.recover();
            }
        }
        setTexture(value) {
            if (this._tex)
                this._tex.off("reload", this, this.onTextureReload);
            this._tex = value;
            if (value) {
                value.on("reload", this, this.onTextureReload);
                this.createCmd();
            }
            else {
                if (this._drawCmd)
                    this._drawCmd = this._owner.graphics.replaceCmd(this._drawCmd, null, true);
            }
        }
        setMesh(value) {
            if (this._meshFactory === value) {
                this._owner.graphics.repaint();
                return;
            }
            this._meshFactory = value;
            if (this._tex)
                this.createCmd();
        }
        setColor(value) {
            this._color.parse(value);
            if (this._drawCmd) {
                this._drawCmd.color = this._color.getABGR();
                this._owner.graphics.repaint();
            }
        }
        onTextureReload() {
            var _a;
            (_a = this._onReload) === null || _a === void 0 ? void 0 : _a.call(this);
            this.setTexture(this._tex);
        }
        createCmd() {
            let drawClass;
            if (this._meshFactory)
                drawClass = Laya.DrawTrianglesCmd;
            else if (this._tex._sizeGrid)
                drawClass = Laya.Draw9GridTextureCmd;
            else
                drawClass = Laya.DrawTextureCmd;
            if (this._drawCmd && this._drawCmd.cmdID === drawClass.ID) {
                this._drawCmd.texture = this._tex;
                if (drawClass === Laya.DrawTrianglesCmd)
                    this._drawCmd.mesh = this._meshFactory;
                else if (drawClass === Laya.Draw9GridTextureCmd)
                    this._drawCmd.sizeGrid = this._tex._sizeGrid;
                this._owner.graphics.repaint();
                return;
            }
            let cmd;
            if (this._meshFactory)
                cmd = Laya.DrawTrianglesCmd.create2(this._tex, this._meshFactory);
            else if (this._tex._sizeGrid)
                cmd = Laya.Draw9GridTextureCmd.create(this._tex, 0, 0, 1, 1, this._tex._sizeGrid, true);
            else
                cmd = Laya.DrawTextureCmd.create(this._tex, 0, 0, 1, 1, null, 1, null, null, null, true);
            cmd.lock = true;
            cmd.color = this._color.getABGR();
            this._drawCmd = this._owner.graphics.replaceCmd(this._drawCmd, cmd, true);
        }
    }

    class GLoader extends GWidget {
        constructor() {
            super();
            this._frame = 0;
            this._autoPlay = true;
            this._loop = true;
            this._srcWidth = 0;
            this._srcHeight = 0;
            this._loadId = 0;
            this._src = "";
            this._color = "#ffffff";
            this._fitMode = exports.LoaderFitMode.Contain;
            this._shrinkOnly = false;
            this._align = exports.AlignType.Center;
            this._valign = exports.VAlignType.Middle;
            this._content = new Laya.Sprite();
            this._content.hideFlags |= Laya.HideFlags.HideAndDontSave;
            this._renderer = new ImageRenderer(this._content);
            this._renderer._onReload = () => this.onTextureReload();
            this.addChild(this._content);
        }
        get src() {
            return this._src;
        }
        set src(value) {
            if (value == null)
                value = "";
            if (this._src == value)
                return;
            this._src = value;
            if (value)
                this.loadContent();
            else
                this.clearContent();
        }
        get icon() {
            return this._src;
        }
        set icon(value) {
            this.src = value;
        }
        get align() {
            return this._align;
        }
        set align(value) {
            if (this._align != value) {
                this._align = value;
                Laya.ILaya.timer.callLater(this, this.updateLayout);
            }
        }
        get valign() {
            return this._valign;
        }
        set valign(value) {
            if (this._valign != value) {
                this._valign = value;
                Laya.ILaya.timer.callLater(this, this.updateLayout);
            }
        }
        get fitMode() {
            return this._fitMode;
        }
        set fitMode(value) {
            if (this._fitMode != value) {
                this._fitMode = value;
                Laya.ILaya.timer.callLater(this, this.updateLayout);
            }
        }
        get shrinkOnly() {
            return this._shrinkOnly;
        }
        set shrinkOnly(value) {
            if (this._shrinkOnly != value) {
                this._shrinkOnly = value;
                Laya.ILaya.timer.callLater(this, this.updateLayout);
            }
        }
        get color() {
            return this._color;
        }
        set color(value) {
            this._color = value;
            this._renderer.setColor(value);
            if (this._ani)
                this._ani.color = this._ani.color.parse(value);
        }
        get ani() {
            return this._ani;
        }
        get frame() {
            return this._frame;
        }
        set frame(value) {
            this._frame = value;
            if (this._ani)
                this._ani.frame = value;
        }
        get autoPlay() {
            return this._autoPlay;
        }
        set autoPlay(value) {
            this._autoPlay = value;
            if (this._ani)
                this._ani.autoPlay = value;
        }
        get loop() {
            return this._loop;
        }
        set loop(value) {
            this._loop = value;
            if (this._ani)
                this._ani.loop = value;
        }
        get texture() {
            return this._renderer._tex;
        }
        set texture(value) {
            this._src = "instance-0";
            this.onLoaded(value, ++this._loadId);
        }
        get mesh() {
            return this._renderer._meshFactory;
        }
        set mesh(value) {
            this._renderer.setMesh(value);
        }
        get material() {
            return this._content.material;
        }
        set material(value) {
            this._content.material = value;
        }
        loadContent() {
            let loadID = ++this._loadId;
            let res = Laya.Loader.getRes(this._src, Laya.Loader.IMAGE);
            if (!res)
                Laya.ILaya.loader.load(this._src, { maybeType: Laya.Loader.IMAGE }).then(res => this.onLoaded(res, loadID));
            else
                this.onLoaded(res, loadID);
        }
        onLoaded(value, loadID) {
            if (this._loadId != loadID || this.destroyed)
                return;
            if (value instanceof Laya.Texture) {
                if (this._ani)
                    this._ani.setAtlas(null);
                this._renderer.setTexture(value);
                this._srcWidth = value.sourceWidth;
                this._srcHeight = value.sourceHeight;
            }
            else if (value instanceof Laya.AtlasResource) {
                this._renderer.setTexture(null);
                if (!this._ani) {
                    this._ani = this._content.addComponent(Laya.FrameAnimation);
                    this._ani.color = this._ani.color.parse(this._color);
                    this._ani.stretchMode = Laya.AnimationStretchMode.Fill;
                    this._ani.autoPlay = this._autoPlay;
                    this._ani.loop = this._loop;
                    this._ani.frame = this._frame;
                }
                this._ani.setAtlas(value);
                this._srcWidth = this._ani.width;
                this._srcHeight = this._ani.height;
            }
            else {
                this._renderer.setTexture(null);
                if (this._ani)
                    this._ani.setAtlas(null);
                this._srcWidth = 0;
                this._srcHeight = 0;
            }
            Laya.ILaya.timer.runCallLater(this, this.updateLayout, true);
            this.event(Laya.Event.LOADED);
        }
        onTextureReload() {
            let tex = this._renderer._tex;
            this._srcWidth = tex.sourceWidth;
            this._srcHeight = tex.sourceHeight;
            Laya.ILaya.timer.runCallLater(this, this.updateLayout, true);
            this.event(Laya.Event.LOADED);
        }
        clearContent() {
            this._srcWidth = 0;
            this._srcHeight = 0;
            this._loadId++;
            this._renderer.setTexture(null);
            if (this._ani)
                this._ani.source = null;
        }
        updateLayout() {
            let cw = this._srcWidth, ch = this._srcHeight;
            if (cw == 0 || ch == 0)
                return;
            this._updatingLayout = true;
            let sx = 1, sy = 1;
            if (this._fitMode != exports.LoaderFitMode.None && cw != 0 && ch != 0) {
                sx = this.width / cw;
                sy = this.height / ch;
                if (sx != 1 || sy != 1) {
                    if (this._fitMode == exports.LoaderFitMode.CoverHeight)
                        sx = sy;
                    else if (this._fitMode == exports.LoaderFitMode.CoverWidth)
                        sy = sx;
                    else if (this._fitMode == exports.LoaderFitMode.Contain) {
                        if (sx > sy)
                            sx = sy;
                        else
                            sy = sx;
                    }
                    else if (this._fitMode == exports.LoaderFitMode.Cover) {
                        if (sx > sy)
                            sy = sx;
                        else
                            sx = sy;
                    }
                    if (this._shrinkOnly) {
                        if (sx > 1)
                            sx = 1;
                        if (sy > 1)
                            sy = 1;
                    }
                    cw = cw * sx;
                    ch = ch * sy;
                }
            }
            this._content.size(cw, ch);
            let nx, ny;
            if (this._align == exports.AlignType.Center)
                nx = Math.floor((this.width - cw) / 2);
            else if (this._align == exports.AlignType.Right)
                nx = this.width - cw;
            else
                nx = 0;
            if (this._valign == exports.VAlignType.Middle)
                ny = Math.floor((this.height - ch) / 2);
            else if (this._valign == exports.VAlignType.Bottom)
                ny = this.height - ch;
            else
                ny = 0;
            this._content.pos(nx, ny);
            this._updatingLayout = false;
        }
        _sizeChanged() {
            super._sizeChanged();
            if (!this._updatingLayout)
                Laya.ILaya.timer.callLater(this, this.updateLayout);
        }
        destroy() {
            super.destroy();
            this._renderer.destroy();
        }
    }

    class GWindow extends GWidget {
        constructor() {
            super();
            this._requestingCmd = 0;
            this.bringToFontOnClick = UIConfig2.bringWindowToFrontOnClick;
            this.on(Laya.Event.DISPLAY, this, this._onShown);
            this.on(Laya.Event.UNDISPLAY, this, this._onHidden);
            this.on(Laya.Event.MOUSE_DOWN, this, this._winTouchBegin);
        }
        get contentPane() {
            return this._contentPane;
        }
        set contentPane(value) {
            if (this._contentPane != value) {
                if (this._contentPane)
                    this.removeChild(this._contentPane);
                this._contentPane = value;
                if (this._contentPane) {
                    this.addChild(this._contentPane);
                    this.size(this._contentPane.width, this._contentPane.height);
                    this._contentPane.addRelation(this, exports.RelationType.Size);
                    this._frame = this._contentPane.getChild("frame");
                    if (this._frame) {
                        this.closeButton = this._frame.getChild("closeButton");
                        this.dragArea = this._frame.getChild("dragArea");
                        this.contentArea = this._frame.getChild("contentArea");
                    }
                }
            }
        }
        get frame() {
            return this._frame;
        }
        get closeButton() {
            return this._closeButton;
        }
        set closeButton(value) {
            if (this._closeButton)
                this._closeButton.off(Laya.Event.CLICK, this, this.closeEventHandler);
            this._closeButton = value;
            if (this._closeButton)
                this._closeButton.on(Laya.Event.CLICK, this, this.closeEventHandler);
        }
        get dragArea() {
            return this._dragArea;
        }
        set dragArea(value) {
            if (this._dragArea != value) {
                if (this._dragArea) {
                    this._dragArea.draggable = false;
                    this._dragArea.off(Laya.Event.DRAG_START, this, this._dragStart);
                }
                this._dragArea = value;
                if (this._dragArea) {
                    this._dragArea.draggable = true;
                    this._dragArea.on(Laya.Event.DRAG_START, this, this._dragStart);
                }
            }
        }
        get contentArea() {
            return this._contentArea;
        }
        set contentArea(value) {
            this._contentArea = value;
        }
        show() {
            GWidget._defaultRoot.showWindow(this);
        }
        hide() {
            if (this.isShowing)
                this.doHideAnimation();
        }
        hideImmediately() {
            GWidget._defaultRoot.hideWindowImmediately(this);
        }
        toggleStatus() {
            if (this.isTop)
                this.hide();
            else
                this.show();
        }
        get isShowing() {
            return this.parent != null;
        }
        get isTop() {
            return this.parent && this.parent.getChildIndex(this) == this.parent.numChildren - 1;
        }
        get modal() {
            return this._modal;
        }
        set modal(val) {
            this._modal = val;
        }
        bringToFront() {
            GWidget._defaultRoot.bringToFront(this);
        }
        showModalWait(requestingCmd) {
            if (requestingCmd != null)
                this._requestingCmd = requestingCmd;
            if (UIConfig2.windowModalWaiting) {
                if (!this._modalWaitPane)
                    this._modalWaitPane = Laya.Loader.createNodes(UIConfig2.windowModalWaiting);
                this._modalWaitPane.mouseEnabled = true;
                this.layoutModalWaitPane();
                this.addChild(this._modalWaitPane);
            }
        }
        layoutModalWaitPane() {
            if (this._contentArea) {
                let pt = this._frame.localToGlobal(s_pt.setTo(0, 0));
                pt = this.globalToLocal(pt);
                this._modalWaitPane.pos(pt.x + this._contentArea.x, pt.y + this._contentArea.y);
                this._modalWaitPane.size(this._contentArea.width, this._contentArea.height);
            }
            else
                this._modalWaitPane.size(this.width, this.height);
        }
        closeModalWait(requestingCmd) {
            if (requestingCmd != null) {
                if (this._requestingCmd != requestingCmd)
                    return false;
            }
            this._requestingCmd = 0;
            if (this.modalWaiting)
                this.removeChild(this._modalWaitPane);
            return true;
        }
        get modalWaiting() {
            return this._modalWaitPane != null && this._modalWaitPane.parent != null;
        }
        onInit() {
        }
        onShown() {
        }
        onHide() {
        }
        doShowAnimation() {
            this.onShown();
        }
        doHideAnimation() {
            this.hideImmediately();
        }
        destroy() {
            if (this.parent)
                this.hideImmediately();
            super.destroy();
        }
        closeEventHandler() {
            this.hide();
        }
        _onShown() {
            if (!this._inited) {
                if (!this._loading) {
                    this._loading = true;
                    Promise.resolve(this.onInit()).then(() => {
                        this._loading = false;
                        this._inited = true;
                        if (this.isShowing)
                            this.doShowAnimation();
                    });
                }
            }
            else
                this.doShowAnimation();
        }
        _onHidden() {
            this.closeModalWait();
            this.onHide();
        }
        _winTouchBegin() {
            if (this.isShowing && this.bringToFontOnClick)
                this.bringToFront();
        }
        _dragStart() {
            this._dragArea.stopDrag();
            this.startDrag();
        }
    }
    const s_pt = new Laya.Point();

    const popupTargetKey = Symbol("popupTarget");
    class PopupManager {
        constructor(owner) {
            this._owner = owner;
            this._popupStack = [];
            this._justClosedPopups = [];
            Laya.InputManager.onMouseDownCapture.add(this._touchBegin, this);
            Laya.ILaya.stage.on(Laya.Event.BLUR, this, this.checkPopups);
        }
        showPopup(popup, target, dir) {
            if (this._popupStack.length > 0) {
                let k = this._popupStack.indexOf(popup);
                if (k != -1) {
                    for (let i = this._popupStack.length - 1; i >= k; i--)
                        this._owner.removeChild(this._popupStack.pop());
                }
            }
            this._popupStack.push(popup);
            if (target) {
                let p = target;
                while (p) {
                    if (p.parent == this._owner) {
                        if (popup.zOrder < p.zOrder) {
                            popup.zOrder = p.zOrder;
                        }
                        break;
                    }
                    p = p.parent;
                }
            }
            popup[popupTargetKey] = target;
            this._owner.addChild(popup);
            this._owner.adjustModalLayer();
            this.validatePopupPosition(popup, target, dir);
        }
        validatePopupPosition(popup, target, dir, offsetX, offsetY) {
            let px, py;
            let sizeW = 0, sizeH = 0;
            if (offsetX == null)
                offsetX = 0;
            if (offsetY == null)
                offsetY = 0;
            if (target) {
                let pos = target.localToGlobal(Laya.Point.TEMP.setTo(0, 0));
                px = pos.x;
                py = pos.y;
                let size = target.localToGlobal(Laya.Point.TEMP.setTo(target.width, target.height));
                sizeW = size.x - px;
                sizeH = size.y - py;
            }
            else {
                let pos = this._owner.globalToLocal(Laya.Point.TEMP.copy(Laya.InputManager.getTouchPos()));
                px = pos.x;
                py = pos.y;
            }
            let xx, yy;
            xx = px + offsetX;
            if (xx + popup.width > this._owner.width)
                xx = px + sizeW - popup.width - offsetX;
            yy = py + sizeH + offsetY;
            if (((dir === undefined || dir === exports.PopupDirection.Auto) && yy + popup.height > this._owner.height)
                || dir === exports.PopupDirection.Up) {
                yy = py - popup.height - offsetY - 1;
                if (yy < 0) {
                    yy = 0;
                    xx += sizeW / 2;
                    if (xx + popup.width > this._owner.width)
                        xx = this._owner.width - popup.width;
                }
            }
            popup.pos(xx, yy);
        }
        togglePopup(popup, target, dir) {
            if (this._justClosedPopups.indexOf(popup) != -1)
                return false;
            this.showPopup(popup, target, dir);
            return true;
        }
        hidePopup(popup) {
            if (popup) {
                let k = this._popupStack.indexOf(popup);
                if (k != -1) {
                    for (let i = this._popupStack.length - 1; i >= k; i--)
                        this.closePopup(this._popupStack.pop());
                }
            }
            else {
                let cnt = this._popupStack.length;
                for (let i = cnt - 1; i >= 0; i--)
                    this.closePopup(this._popupStack[i]);
                this._popupStack.length = 0;
            }
        }
        get hasAnyPopup() {
            return this._popupStack.length != 0;
        }
        isPopupJustClosed(popup) {
            return this._justClosedPopups.indexOf(popup) != -1;
        }
        closePopup(popup) {
            if (popup.parent) {
                if (popup instanceof GWindow)
                    popup.hide();
                else
                    this._owner.removeChild(popup);
            }
        }
        showTooltips(msg, delay) {
            if (this._defaultTooltipWin == null) {
                if (!UIConfig2.tooltipsWidget) {
                    console.warn("UIConfig.tooltipsWidget not defined");
                    return;
                }
                this._defaultTooltipWin = Laya.Loader.createNodes(UIConfig2.tooltipsWidget);
                this._defaultTooltipWin.mouseEnabled = false;
            }
            this._defaultTooltipWin.text = msg;
            this.showTooltipsWin(this._defaultTooltipWin, delay);
        }
        showTooltipsWin(tooltipWin, delay) {
            this.hideTooltips();
            this._tooltipWin = tooltipWin;
            if (delay != null && delay != 0)
                Laya.ILaya.timer.once(delay, this, this._doShowTooltips);
            else
                this._doShowTooltips();
        }
        _doShowTooltips() {
            if (this._tooltipWin == null)
                return;
            this.validatePopupPosition(this._tooltipWin, null, exports.PopupDirection.Auto, 10, 20);
            this._owner.addChild(this._tooltipWin);
        }
        hideTooltips() {
            if (this._tooltipWin) {
                if (this._tooltipWin.parent)
                    this._owner.removeChild(this._tooltipWin);
                this._tooltipWin = null;
            }
        }
        checkPopups() {
            this._justClosedPopups.length = 0;
            if (this._popupStack.length > 0) {
                let gobj = Laya.InputManager.touchTarget;
                let handled = false;
                while (gobj) {
                    let k = this._popupStack.indexOf(gobj);
                    if (k != -1) {
                        for (let i = this._popupStack.length - 1; i > k; i--) {
                            let last = this._popupStack.length - 1;
                            let popup = this._popupStack[last];
                            this.closePopup(popup);
                            this._justClosedPopups.push(popup);
                            this._popupStack.splice(last, 1);
                        }
                        handled = true;
                        break;
                    }
                    gobj = gobj.parent;
                }
                if (!handled) {
                    for (let i = this._popupStack.length - 1; i >= 0; i--) {
                        let popup = this._popupStack[i];
                        this.closePopup(popup);
                        this._justClosedPopups.push(popup);
                        this._popupStack.splice(i, 1);
                    }
                }
            }
        }
        _touchBegin() {
            if (this._tooltipWin)
                this.hideTooltips();
            this.checkPopups();
        }
    }

    class GRoot extends GWidget {
        static get inst() {
            var _a;
            return (_a = GWidget._defaultRoot) !== null && _a !== void 0 ? _a : (GWidget._defaultRoot = new GRoot());
        }
        constructor() {
            super();
            this.name = "GRoot";
            this.zOrder = GRoot.LAYER;
            this.mouseThrough = true;
            if (!Laya.LayaEnv.isPlaying)
                this.hideFlags |= Laya.HideFlags.HideAndDontSave;
            this.hideFlags |= Laya.HideFlags.HideTransformTool;
            this.size(Laya.ILaya.stage.width, Laya.ILaya.stage.height);
            Laya.ILaya.stage.addChild(this);
            this._popupMgr = new PopupManager(this);
            this._modalLayer = new GWidget();
            this._modalLayer.mouseEnabled = true;
            this._modalLayer.hideFlags |= Laya.HideFlags.HideAndDontSave;
            this._modalLayer.size(this.width, this.height);
            this._modalLayer.addRelation(this, exports.RelationType.Size);
            Laya.ILaya.stage.on(Laya.Event.RESIZE, () => {
                this.size(Laya.ILaya.stage.width, Laya.ILaya.stage.height);
            });
        }
        get popupMgr() {
            return this._popupMgr;
        }
        showWindow(win) {
            this.addChild(win);
            if (win.x > this.width)
                win.x = this.width - win.width;
            else if (win.x + win.width < 0)
                win.x = 0;
            if (win.y > this.height)
                win.y = this.height - win.height;
            else if (win.y + win.height < 0)
                win.y = 0;
            this.adjustModalLayer();
        }
        hideWindow(win) {
            win.hide();
        }
        hideWindowImmediately(win) {
            if (win.parent == this)
                this.removeChild(win);
            this.adjustModalLayer();
        }
        bringToFront(win) {
            let cnt = this.numChildren;
            let i;
            if (this._modalLayer.parent && !win.modal)
                i = this.getChildIndex(this._modalLayer) - 1;
            else
                i = cnt - 1;
            for (; i >= 0; i--) {
                let g = this.getChildAt(i);
                if (g == win)
                    return;
                if (g instanceof GWindow)
                    break;
            }
            if (i >= 0)
                this.setChildIndex(win, i);
        }
        showModalWait(msg) {
            if (UIConfig2.globalModalWaiting) {
                if (this._modalWaitPane == null)
                    this._modalWaitPane = Laya.Loader.createNodes(UIConfig2.globalModalWaiting);
                this._modalWaitPane.size(this.width, this.height);
                this._modalWaitPane.addRelation(this, exports.RelationType.Size);
                this.addChild(this._modalWaitPane);
                this._modalWaitPane.text = msg || "";
            }
        }
        closeModalWait() {
            if (this._modalWaitPane && this._modalWaitPane.parent)
                this.removeChild(this._modalWaitPane);
        }
        closeAllExceptModals() {
            let arr = this.children.slice();
            let cnt = arr.length;
            for (let i = 0; i < cnt; i++) {
                let g = arr[i];
                if ((g instanceof GWindow) && !g.modal)
                    g.hide();
            }
        }
        closeAllWindows() {
            let arr = this.children.slice();
            let cnt = arr.length;
            for (let i = 0; i < cnt; i++) {
                let g = arr[i];
                if (g instanceof GWindow)
                    g.hide();
            }
        }
        getTopWindow() {
            let cnt = this.numChildren;
            for (let i = cnt - 1; i >= 0; i--) {
                let g = this.getChildAt(i);
                if (g instanceof GWindow) {
                    return g;
                }
            }
            return null;
        }
        get modalLayer() {
            return this._modalLayer;
        }
        get hasModalWindow() {
            return this._modalLayer.parent != null;
        }
        get modalWaiting() {
            return this._modalWaitPane && this._modalWaitPane.displayedInStage;
        }
        showPopup(popup, target, dir) {
            this._popupMgr.showPopup(popup, target, dir);
        }
        togglePopup(popup, target, dir) {
            return this._popupMgr.togglePopup(popup, target, dir);
        }
        hidePopup(popup) {
            this._popupMgr.hidePopup(popup);
        }
        get hasAnyPopup() {
            return this._popupMgr.hasAnyPopup;
        }
        adjustModalLayer() {
            let cnt = this.numChildren;
            if (this._modalWaitPane && this._modalWaitPane.parent)
                this.setChildIndex(this._modalWaitPane, cnt - 1);
            for (let i = cnt - 1; i >= 0; i--) {
                let g = this.getChildAt(i);
                if ((g instanceof GWindow) && g.modal) {
                    if (this._modalLayer.graphics.cmds.length === 0)
                        this._modalLayer.graphics.drawRect(0, 0, 1, 1, UIConfig2.modalLayerColor, null, 0, true);
                    if (this._modalLayer.parent == null)
                        this.addChildAt(this._modalLayer, i);
                    else
                        this.setChildIndexBefore(this._modalLayer, i);
                    return;
                }
            }
            if (this._modalLayer.parent)
                this.removeChild(this._modalLayer);
        }
    }
    GRoot.LAYER = 1000;

    class DragDropManager {
        static get inst() {
            return DragDropManager._inst || (DragDropManager._inst = new DragDropManager());
        }
        constructor() {
            this.iconWidth = 200;
            this.iconHeight = 200;
            let agent = this.agent = new GLoader();
            agent.name = "dragAgent";
            agent.anchor(0.5, 0.5);
            agent.mouseEnabled = false;
            agent.draggable = true;
            agent.fitMode = exports.LoaderFitMode.Contain;
            agent.shrinkOnly = true;
            agent.align = exports.AlignType.Center;
            agent.valign = exports.VAlignType.Middle;
            agent.zOrder = Number.POSITIVE_INFINITY;
            agent.on(Laya.Event.DRAG_END, this, this._dragEnd);
        }
        get dragging() {
            return this.agent.parent != null;
        }
        start(source, icon, data, iconWidth, iconHeight) {
            if (this.agent.parent != null)
                return;
            this._source = source;
            let pt = Laya.InputManager.getTouchPos();
            this.agent.pos(pt.x, pt.y);
            if (typeof (icon) === 'string')
                this.agent.src = icon;
            else if (icon != null) {
                if (this._rt == null) {
                    let rt = new Laya.RenderTexture2D(this.iconWidth, this.iconHeight, Laya.RenderTargetFormat.R8G8B8A8);
                    this._rt = new Laya.Texture(rt);
                }
                icon.drawToRenderTexture2D(this._rt.width, this._rt.height, 0, 0, this._rt.bitmap, true, true);
                this.agent.texture = this._rt;
            }
            this.agent.size(iconWidth || this.iconWidth, iconHeight || this.iconHeight);
            GRoot.inst.addChild(this.agent);
            this.agent.startDrag(null, false, null, null, data);
        }
        stop() {
            if (this.agent.parent != null) {
                this.agent.src = null;
                this.agent.stopDrag();
                this.agent.removeSelf();
                this._source = null;
            }
        }
        _dragEnd(data, cancelled) {
            if (this.agent.parent == null)
                return;
            this.agent.src = null;
            this.agent.removeSelf();
            let source = this._source;
            this._source = null;
            if (!cancelled) {
                let obj = Laya.InputManager.touchTarget;
                while (obj != null) {
                    if (obj.hasListener(Laya.Event.DROP)) {
                        obj.event(Laya.Event.DROP, [source, data]);
                        return;
                    }
                    obj = obj.parent;
                }
            }
        }
    }

    class StretchParam {
        constructor() {
            this.ratio = 0;
            this.priority = 0;
            this.min = 0;
            this.max = 0;
        }
        setRatio(value) {
            this.ratio = value;
            return this;
        }
        setPriority(value) {
            this.priority = value;
            return this;
        }
        setLimit(min, max) {
            this.min = min;
            this.max = max;
            return this;
        }
        setFixed() {
            this.fixed = true;
            return this;
        }
    }

    class Layout {
        constructor(owner) {
            this._type = 0;
            this._rows = 0;
            this._columns = 0;
            this._rowGap = 0;
            this._columnGap = 0;
            this._stretchX = 0;
            this._stretchY = 0;
            this._pageMode = false;
            this._align = 0;
            this._valign = 0;
            this._minChildSize = 0;
            this._contentWidth = 0;
            this._contentHeight = 0;
            this._owner = owner;
            this._padding = [0, 0, 0, 0];
            this._stretchParamsX = [];
            this._stretchParamsY = [];
        }
        get type() {
            return this._type;
        }
        set type(value) {
            var _a;
            if (this._type !== value) {
                this._type = value;
                if (!Laya.SerializeUtil.isDeserializing) {
                    (_a = this._owner.scroller) === null || _a === void 0 ? void 0 : _a._setDefaultDirection();
                    switch (value) {
                        case exports.LayoutType.SingleColumn:
                        case exports.LayoutType.FlowX:
                            this._stretchY = exports.StretchMode.None;
                            break;
                        case exports.LayoutType.SingleRow:
                        case exports.LayoutType.FlowY:
                            this._stretchX = exports.StretchMode.None;
                            break;
                    }
                }
                this.setChangedFlag();
            }
        }
        get rows() {
            return this._rows;
        }
        set rows(value) {
            if (this._rows !== value) {
                this._rows = value;
                this.setChangedFlag();
            }
        }
        get columns() {
            return this._columns;
        }
        set columns(value) {
            if (this._columns !== value) {
                this._columns = value;
                this.setChangedFlag();
            }
        }
        get rowGap() {
            return this._rowGap;
        }
        set rowGap(value) {
            if (this._rowGap !== value) {
                this._rowGap = value;
                this.setChangedFlag();
            }
        }
        get columnGap() {
            return this._columnGap;
        }
        set columnGap(value) {
            if (this._columnGap !== value) {
                this._columnGap = value;
                this.setChangedFlag();
            }
        }
        get padding() {
            return this._padding;
        }
        set padding(value) {
            var _a;
            if (value == null || !Array.isArray(value))
                value = [0, 0, 0, 0];
            this._padding = value;
            this.setChangedFlag();
            (_a = this._owner.scroller) === null || _a === void 0 ? void 0 : _a._ownerSizeChanged();
        }
        get align() {
            return this._align;
        }
        set align(value) {
            if (this._align !== value) {
                this._align = value;
                this.setChangedFlag();
            }
        }
        get valign() {
            return this._valign;
        }
        set valign(value) {
            if (this._valign !== value) {
                this._valign = value;
                this.setChangedFlag();
            }
        }
        get stretchX() {
            return this._stretchX;
        }
        set stretchX(value) {
            if (this._stretchX !== value) {
                this._stretchX = value;
                this.setChangedFlag();
            }
        }
        get stretchY() {
            return this._stretchY;
        }
        set stretchY(value) {
            if (this._stretchY !== value) {
                this._stretchY = value;
                this.setChangedFlag();
            }
        }
        get stretchParamsX() {
            return this._stretchParamsX;
        }
        set stretchParamsX(value) {
            this._stretchParamsX.length = 0;
            this._stretchParamsX.push(...value);
        }
        get stretchParamsY() {
            return this._stretchParamsY;
        }
        set stretchParamsY(value) {
            this._stretchParamsY.length = 0;
            this._stretchParamsY.push(...value);
        }
        get foldInvisibles() {
            return this._foldInvisibles;
        }
        set foldInvisibles(value) {
            if (this._foldInvisibles != value) {
                this._foldInvisibles = value;
                this.setChangedFlag();
            }
        }
        get minChildSize() {
            return this._minChildSize;
        }
        set minChildSize(value) {
            if (this._minChildSize !== value) {
                this._minChildSize = value;
                this.setChangedFlag();
            }
        }
        get pageMode() {
            return this._pageMode;
        }
        set pageMode(value) {
            if (this._pageMode != value) {
                this._pageMode = value;
                this.setChangedFlag();
            }
        }
        getSnappingPosition(xValue, yValue, xDir, yDir, resultPoint) {
            if (!resultPoint)
                resultPoint = new Laya.Point();
            let children = this._owner.children;
            let cnt = children.length;
            if (cnt === 0) {
                resultPoint.x = 0;
                resultPoint.y = 0;
                return resultPoint;
            }
            this.refresh();
            let obj = null;
            let prev = null;
            let i = 0;
            if (yValue !== 0) {
                for (; i < cnt; i++) {
                    obj = children[i];
                    if (yValue < obj.top) {
                        if (i === 0) {
                            yValue = 0;
                            break;
                        }
                        else {
                            prev = children[i - 1];
                            if (yValue < prev.top + prev.height / 2)
                                yValue = prev.top;
                            else
                                yValue = obj.top;
                            break;
                        }
                    }
                }
                if (i === cnt)
                    yValue = obj.top;
            }
            if (xValue !== 0) {
                if (i > 0)
                    i--;
                for (; i < cnt; i++) {
                    obj = children[i];
                    if (xValue < obj.left) {
                        if (i === 0) {
                            xValue = 0;
                            break;
                        }
                        else {
                            prev = children[i - 1];
                            if (xValue < prev.left + prev.width / 2)
                                xValue = prev.left;
                            else
                                xValue = obj.left;
                            break;
                        }
                    }
                }
                if (i === cnt)
                    xValue = obj.left;
            }
            resultPoint.x = xValue;
            resultPoint.y = yValue;
            return resultPoint;
        }
        setChangedFlag(reason) {
            if (this._layoutChanged)
                return;
            let layout = this._type;
            if (layout === exports.LayoutType.None && !this._owner.scroller)
                return;
            if (reason === exports.LayoutChangedReason.Visible && !this._foldInvisibles)
                return;
            if (reason === exports.LayoutChangedReason.Pos && layout !== exports.LayoutType.None)
                return;
            if (reason === exports.LayoutChangedReason.Size)
                this._childSizeChangedFlag = true;
            this._layoutChanged = true;
            if (_dirtyLayouts.indexOf(this) === -1) {
                _dirtyLayouts.push(this);
                if (!_timerAdded) {
                    _timerAdded = true;
                    Laya.ILaya.timer.callLater(null, Layout.refreshAllLayouts);
                }
            }
        }
        refresh(force) {
            if (this._owner.destroyed || this._disabled) {
                this._layoutChanged = false;
                return;
            }
            if (force) {
                if (!this._layoutChanged)
                    this._childSizeChangedFlag = true;
            }
            else if (!this._layoutChanged || this._refreshing)
                return;
            this._refreshing = true;
            switch (this._type) {
                case exports.LayoutType.None:
                    this.applyNone();
                    break;
                case exports.LayoutType.SingleRow:
                    this.applyFlowX(true);
                    break;
                case exports.LayoutType.SingleColumn:
                    this.applyFlowY(true);
                    break;
                case exports.LayoutType.FlowX:
                    this.applyFlowX();
                    break;
                case exports.LayoutType.FlowY:
                    this.applyFlowY();
                    break;
            }
            this._refreshing = false;
            this._layoutChanged = false;
            this._childSizeChangedFlag = false;
        }
        get viewWidth() {
            var _a;
            let v = (_a = this._owner.scroller) === null || _a === void 0 ? void 0 : _a.viewWidth;
            if (v == null)
                v = this._owner.width - this._padding[3] - this._padding[1];
            return v;
        }
        set viewWidth(value) {
            if (this._owner.scroller)
                this._owner.scroller.setViewSize(value, this._owner.scroller.viewHeight);
            else
                this._owner.width = value + this._padding[3] + this._padding[1];
        }
        get viewHeight() {
            var _a;
            let v = (_a = this._owner.scroller) === null || _a === void 0 ? void 0 : _a.viewHeight;
            if (v == null)
                v = this._owner.height - this._padding[0] - this._padding[2];
            return v;
        }
        set viewHeight(value) {
            if (this._owner.scroller)
                this._owner.scroller.setViewSize(this._owner.scroller.viewWidth, value);
            else
                this._owner.height = value + this._padding[0] + this._padding[2];
        }
        get contentWidth() {
            return this._contentWidth;
        }
        get contentHeight() {
            return this._contentHeight;
        }
        setContentSize(aw, ah) {
            var _a;
            this._contentWidth = aw;
            this._contentHeight = ah;
            if (aw !== 0 && ah !== 0) {
                if (this._stretchX === exports.StretchMode.ResizeToFit && this._stretchY === exports.StretchMode.ResizeToFit) {
                    if (this._owner.scroller)
                        this._owner.scroller.setViewSize(aw, ah);
                    else
                        this._owner.size(aw + this._padding[3] + this._padding[1], ah + this._padding[0] + this._padding[2]);
                }
                else if (this._stretchX === exports.StretchMode.ResizeToFit)
                    this.viewWidth = aw;
                else if (this._stretchY === exports.StretchMode.ResizeToFit)
                    this.viewHeight = ah;
            }
            (_a = this._owner.scroller) === null || _a === void 0 ? void 0 : _a._ownerContentSizeChanged();
            this._owner.event(exports.UIEvent.ContentSizeChanged);
        }
        resizeToFit(childCount, minSize) {
            this.refresh();
            let curCount = this._owner.numChildren;
            if (childCount == null || childCount > curCount)
                childCount = curCount;
            minSize = minSize || 0;
            if (childCount === 0) {
                if (this._type === exports.LayoutType.SingleColumn || this._type === exports.LayoutType.FlowX)
                    this.viewHeight = minSize;
                else
                    this.viewWidth = minSize;
            }
            else {
                let i = childCount - 1;
                let obj = null;
                while (i >= 0) {
                    obj = this._owner.getChildAt(i);
                    if ((!this._foldInvisibles || obj._struct.enabled) && !obj._getBit(Laya.NodeFlags.ESCAPE_LAYOUT))
                        break;
                    i--;
                }
                if (i < 0) {
                    if (this._type === exports.LayoutType.SingleColumn || this._type === exports.LayoutType.FlowX)
                        this.viewHeight = minSize;
                    else
                        this.viewWidth = minSize;
                }
                else {
                    let size = 0;
                    if (this._type === exports.LayoutType.SingleColumn || this._type === exports.LayoutType.FlowX) {
                        size = obj.y + obj.height;
                        if (size < minSize)
                            size = minSize;
                        this.viewHeight = size;
                    }
                    else {
                        size = obj.x + obj.width;
                        if (size < minSize)
                            size = minSize;
                        this.viewWidth = size;
                    }
                }
            }
        }
        applyNone() {
            Laya.SpriteUtils.getChildrenBounds(this._owner, false, this._foldInvisibles, false, s_rect$1);
            this.setContentSize(Math.max(0, Math.ceil(s_rect$1.right)), Math.max(0, Math.ceil(s_rect$1.bottom)));
        }
        applyFlowX(singleRow) {
            var _a;
            let rows = this._rows;
            let cols = this._columns;
            let pageMode = this._pageMode;
            if (singleRow) {
                rows = 1;
                if (cols === 0 && !pageMode)
                    cols = 1000000;
            }
            let rowGap = this._rowGap;
            let colGap = this._columnGap;
            let stretchX = this._stretchX === exports.StretchMode.Stretch;
            let stretchY = this._stretchY === exports.StretchMode.Stretch;
            let align = stretchX ? 0 : this._align;
            let valign = stretchY ? 0 : this._valign;
            let data = tempDataPool.take();
            let cnt = this.getLayoutChildren(data);
            let children = data.children;
            let vw = this.viewWidth, vh = this.viewHeight;
            let cx = 0, cy = 0;
            let px = 0, py = 0;
            let ci = 0, ri = 0;
            let cw = 0, ch = 0;
            let mh = 0;
            let pi = 0;
            if (stretchX) {
                if (cols === 0 || cnt < cols)
                    cols = cnt;
                let stretchParamsX = this.checkStretchParams(this._stretchParamsX, data);
                for (let i = 0; i < cols; i++)
                    data.swidth[i] = this._childSizeChangedFlag ? children[i].width : children[i]._giveWidth;
                this.handleStrecth(vw, cols, colGap, stretchParamsX, data.swidth, data.width);
            }
            if (cnt > 0 && stretchY) {
                if (rows === 0)
                    rows = 1;
                for (let i = 0; i < rows; i++)
                    data.sheight[i] = this._childSizeChangedFlag ? children[0].height : children[0]._giveHeight;
                this.handleStrecth(vh, rows, rowGap, this._stretchParamsY, data.sheight, data.height);
            }
            function newLine(i) {
                mh = Math.ceil(mh);
                if (cy !== 0)
                    cy += rowGap;
                if (cx > cw)
                    cw = cx;
                if (align === 1)
                    cx = Math.floor((vw - cx) / 2);
                else if (align === 2)
                    cx = vw - cx;
                else
                    cx = 0;
                if (pageMode) {
                    if ((cy + mh > vh || ri === rows) && cy !== 0) {
                        px += vw;
                        cy = 0;
                        pi++;
                        ri = 0;
                    }
                }
                for (let j = i - ci; j < i; j++) {
                    data.posx[j] += px + cx;
                    data.posy[j] += py + cy;
                }
                cx = 0;
                cy += mh;
                mh = 0;
                ci = 0;
                ri++;
            }
            for (let x = 0; x < 2; x++) {
                for (let i = 0; i < cnt; i++) {
                    let child = children[i];
                    child.size(stretchX ? data.width[ci % cols] : child._giveWidth, stretchY ? data.height[ri % rows] : child._giveHeight, true);
                    let sw = Math.ceil(child.width);
                    if (cols === 0 && cx + colGap + sw > vw && cx !== 0) {
                        newLine(i);
                        child.size(stretchX ? data.width[ci] : child._giveWidth, stretchY ? data.height[ri % rows] : child._giveHeight, true);
                        sw = Math.ceil(child.width);
                    }
                    if (cx !== 0)
                        cx += colGap;
                    data.posx[i] = cx;
                    data.posy[i] = 0;
                    if (singleRow) {
                        if (valign === 1)
                            data.posy[i] = Math.floor((vh - child.height) / 2);
                        else if (valign === 2)
                            data.posy[i] = vh - child.height;
                    }
                    cx += sw;
                    if (child.height > mh)
                        mh = child.height;
                    ci++;
                    if (ci === cols && !singleRow || i === cnt - 1)
                        newLine(i + 1);
                }
                ch = py + cy;
                let checkOverflow = (_a = this._owner.scroller) === null || _a === void 0 ? void 0 : _a._shouldCheckOverflow();
                if (checkOverflow == null)
                    break;
                if (ch <= vh && stretchX && (checkOverflow & 1) !== 0) {
                    vw += this._owner.scroller.vScrollBar.width;
                    this.handleStrecth(vw, cols, colGap, this._stretchParamsX, data.swidth, data.width);
                }
                else
                    checkOverflow &= ~1;
                if (cw <= vw && stretchY && (checkOverflow & 2) !== 0) {
                    vh += this._owner.scroller.hScrollBar.height;
                    this.handleStrecth(vh, rows, rowGap, this._stretchParamsY, data.sheight, data.height);
                }
                else
                    checkOverflow &= ~2;
                if (checkOverflow === 0)
                    break;
                cx = cy = px = py = ci = ri = cw = ch = mh = 0;
            }
            cy = 0;
            if (ch < vh && this._stretchY !== exports.StretchMode.ResizeToFit && !singleRow) {
                if (valign === 1)
                    cy = Math.floor((vh - ch) / 2);
                else if (valign === 2)
                    cy = vh - ch;
            }
            cx = 0;
            if (this._stretchX === exports.StretchMode.ResizeToFit) {
                if (align === 1)
                    cx = Math.floor((cw - vw) / 2);
                else if (align === 2)
                    cx = cw - vw;
            }
            if (!this._owner.scroller) {
                cx += this._padding[3];
                cy += this._padding[0];
            }
            if (singleRow && !stretchY && valign === 3) {
                for (let i = 0; i < cnt; i++)
                    children[i].left = data.posx[i] + cx;
            }
            else {
                for (let i = 0; i < cnt; i++)
                    children[i].setLeftTop(data.posx[i] + cx, data.posy[i] + cy);
            }
            if (pageMode)
                cw = vw * (pi + 1);
            this.setContentSize(cw, ch);
            tempDataPool.recover(data);
        }
        applyFlowY(singleColumn) {
            var _a;
            let rows = this._rows;
            let cols = this._columns;
            let pageMode = this._pageMode;
            if (singleColumn) {
                cols = 1;
                if (rows === 0 && !pageMode)
                    rows = 1000000;
            }
            let rowGap = this._rowGap;
            let colGap = this._columnGap;
            let stretchX = this._stretchX === exports.StretchMode.Stretch;
            let stretchY = this._stretchY === exports.StretchMode.Stretch;
            let align = stretchX ? 0 : this._align;
            let valign = stretchY ? 0 : this._valign;
            let data = tempDataPool.take();
            let cnt = this.getLayoutChildren(data);
            let children = data.children;
            let vw = this.viewWidth, vh = this.viewHeight;
            let cx = 0, cy = 0;
            let px = 0, py = 0;
            let ci = 0, ri = 0;
            let cw = 0, ch = 0;
            let mw = 0;
            let pi = 0;
            if (cnt > 0 && stretchX) {
                if (cols === 0)
                    cols = 1;
                for (let i = 0; i < cols; i++)
                    data.swidth[i] = this._childSizeChangedFlag ? children[0].width : children[0]._giveWidth;
                this.handleStrecth(vw, cols, colGap, this._stretchParamsX, data.swidth, data.width);
            }
            if (stretchY) {
                if (rows === 0 || cnt < rows)
                    rows = cnt;
                let stretchParamsY = this.checkStretchParams(this._stretchParamsY, data);
                for (let i = 0; i < rows; i++)
                    data.sheight[i] = this._childSizeChangedFlag ? children[i].height : children[i]._giveHeight;
                this.handleStrecth(vh, rows, rowGap, stretchParamsY, data.sheight, data.height);
            }
            function newLine(i) {
                mw = Math.ceil(mw);
                if (cx !== 0)
                    cx += colGap;
                if (cy > ch)
                    ch = cy;
                if (valign === 1)
                    cy = Math.floor((vh - cy) / 2);
                else if (valign === 2)
                    cy = vh - cy;
                else
                    cy = 0;
                if (pageMode) {
                    if ((cx + mw > vw || ci === cols) && cx !== 0) {
                        py += vh;
                        cx = 0;
                        pi++;
                        ci = 0;
                    }
                }
                for (let j = i - ri; j < i; j++) {
                    data.posx[j] += px + cx;
                    data.posy[j] += py + cy;
                }
                cy = 0;
                cx += mw;
                mw = 0;
                ri = 0;
                ci++;
            }
            for (let x = 0; x < 2; x++) {
                for (let i = 0; i < cnt; i++) {
                    let child = children[i];
                    child.size(stretchX ? data.width[ci % cols] : child._giveWidth, stretchY ? data.height[ri % rows] : child._giveHeight, true);
                    let sh = Math.ceil(child.height);
                    if (rows === 0 && cy + rowGap + sh > vh && cy !== 0) {
                        newLine(i);
                        child.size(stretchX ? data.width[ci % cols] : child._giveWidth, stretchY ? data.height[ri] : child._giveHeight, true);
                        sh = Math.ceil(child.height);
                    }
                    if (cy !== 0)
                        cy += rowGap;
                    data.posx[i] = 0;
                    data.posy[i] = cy;
                    if (singleColumn) {
                        if (align === 1)
                            data.posx[i] = Math.floor((vw - child.width) / 2);
                        else if (align === 2)
                            data.posx[i] = vw - child.width;
                    }
                    cy += sh;
                    if (child.width > mw)
                        mw = child.width;
                    ri++;
                    if (ri === rows && !singleColumn || i === cnt - 1)
                        newLine(i + 1);
                }
                cw = px + cx;
                let checkOverflow = (_a = this._owner.scroller) === null || _a === void 0 ? void 0 : _a._shouldCheckOverflow();
                if (checkOverflow == null)
                    break;
                if (ch <= vh && stretchX && (checkOverflow & 1) !== 0) {
                    vw += this._owner.scroller.vScrollBar.width;
                    this.handleStrecth(vw, cols, colGap, this._stretchParamsX, data.swidth, data.width);
                }
                else
                    checkOverflow &= ~1;
                if (cw <= vw && stretchY && (checkOverflow & 2) !== 0) {
                    vh += this._owner.scroller.hScrollBar.height;
                    this.handleStrecth(vh, rows, rowGap, this._stretchParamsY, data.sheight, data.height);
                }
                else
                    checkOverflow &= ~2;
                if (checkOverflow === 0)
                    break;
                cx = cy = px = py = ci = ri = cw = ch = mw = 0;
            }
            cx = 0;
            if (cw < vw && this._stretchX !== exports.StretchMode.ResizeToFit && !singleColumn) {
                if (align === 1)
                    cx = Math.floor((vw - cw) / 2);
                else if (align === 2)
                    cx = vw - cw;
            }
            cy = 0;
            if (this._stretchY === exports.StretchMode.ResizeToFit) {
                if (valign === 1)
                    cy = Math.floor((ch - vh) / 2);
                else if (valign === 2)
                    cy = ch - vh;
            }
            if (!this._owner.scroller) {
                cx += this._padding[3];
                cy += this._padding[0];
            }
            if (singleColumn && !stretchX && align === 3) {
                for (let i = 0; i < cnt; i++)
                    children[i].top = data.posy[i] + cy;
            }
            else {
                for (let i = 0; i < cnt; i++)
                    children[i].setLeftTop(data.posx[i] + cx, data.posy[i] + cy);
            }
            if (pageMode)
                ch = vh * (pi + 1);
            this.setContentSize(cw, ch);
            tempDataPool.recover(data);
        }
        getLayoutChildren(data) {
            let i = 0, j = 0;
            data.invisibleCnt = 0;
            for (let child of this._owner.children) {
                if (child._nodeType !== 2)
                    continue;
                if (this._foldInvisibles && !child._struct.enabled || child._getBit(Laya.NodeFlags.ESCAPE_LAYOUT))
                    data.invisibles[data.invisibleCnt++] = i;
                else
                    data.children[j++] = child;
                i++;
            }
            return j;
        }
        checkStretchParams(src, data) {
            if (data.invisibleCnt === 0)
                return src;
            let out = data.stretchParams;
            let j = 0, k = 0;
            let test = data.invisibles[j];
            for (let i = 0; i < src.length; i++) {
                if (i !== test)
                    out[k++] = src[i];
                else {
                    j++;
                    if (j >= data.invisibleCnt)
                        test = -1;
                    else
                        test = data.invisibles[j];
                }
            }
            return out;
        }
        handleStrecth(size, count, gap, params, sourceSizes, outSizes) {
            outSizes = outSizes || sourceSizes;
            if (count === 1 && !params[0]) {
                outSizes[0] = size;
                return;
            }
            let lineSize = Math.max(0, size - gap * (count - 1));
            let minChildSize = this._minChildSize;
            let lineSize2 = 0;
            let lineSize3 = 0;
            let ratio = 0;
            let hasRatio;
            for (let i = 0; i < count; i++) {
                let param = params[i] || defParam;
                if (param.ratio !== 0) {
                    hasRatio = true;
                    ratio += param.ratio;
                }
                else
                    lineSize3 += sourceSizes[i];
            }
            ratio = Math.max(0, 1 - ratio);
            for (let i = 0; i < count; i++) {
                let param = params[i] || defParam;
                let itemSize = sourceSizes[i];
                if (hasRatio) {
                    if (param.ratio !== 0)
                        itemSize = Math.floor(lineSize * param.ratio);
                    else
                        itemSize = ratio * (itemSize / lineSize3);
                }
                if (!param.fixed) {
                    let min = param.min !== 0 ? param.min : minChildSize;
                    if (itemSize < min)
                        itemSize = min;
                    if (param.max > 0 && itemSize > param.max)
                        itemSize = param.max;
                }
                outSizes[i] = itemSize;
                lineSize2 += itemSize;
            }
            let dist = lineSize2 - lineSize;
            if (dist > 0) {
                let round = 0;
                while (dist > 0) {
                    let k = 0;
                    for (let i = 0; i < count; i++) {
                        let param = params[i] || defParam;
                        if (param.fixed) {
                            limit[i] = null;
                            continue;
                        }
                        let min = param.min !== 0 ? param.min : minChildSize;
                        let ts = outSizes[i];
                        if (ts > min
                            && (round >= 2
                                || round === 0 && param.priority > 0
                                || round === 1 && (param == defParam || param.ratio === 0 && param.priority >= 0))) {
                            limit[i] = min;
                            k++;
                        }
                        else
                            limit[i] = null;
                    }
                    if (k === 0) {
                        round++;
                        if (round > 2)
                            break;
                        else
                            continue;
                    }
                    let ps = dist / k;
                    let ps2 = 0;
                    for (let i = 0; i < count; i++) {
                        let min = limit[i];
                        if (min == null)
                            continue;
                        ps2 += ps;
                        k--;
                        if (ps2 < 0) {
                            if (k !== 0)
                                continue;
                            else
                                ps2 = Math.floor(ps2);
                        }
                        let ts = outSizes[i];
                        ps2 = Math.ceil(ps2);
                        ts = Math.max(ts - ps2, min);
                        ps2 = ps - ps2;
                        dist -= (outSizes[i] - ts);
                        outSizes[i] = ts;
                    }
                    dist = Math.floor(dist);
                    round++;
                }
            }
            else if (dist < 0) {
                let round = 0;
                dist = -dist;
                while (dist > 0) {
                    let k = 0;
                    for (let i = 0; i < count; i++) {
                        let param = params[i] || defParam;
                        if (param.fixed) {
                            limit[i] = null;
                            continue;
                        }
                        let max = param.max !== 0 ? param.max : 1000000;
                        let ts = outSizes[i];
                        if (ts < max
                            && (round >= 2
                                || round === 0 && param.priority > 0
                                || round === 1 && (param == defParam || param.ratio === 0 && param.priority >= 0))) {
                            limit[i] = max;
                            k++;
                        }
                        else
                            limit[i] = null;
                    }
                    if (k === 0) {
                        round++;
                        if (round > 2)
                            break;
                        else
                            continue;
                    }
                    let ps = dist / k;
                    let ps2 = 0;
                    for (let i = 0; i < count; i++) {
                        let max = limit[i];
                        if (max == null)
                            continue;
                        ps2 += ps;
                        k--;
                        if (ps2 < 1) {
                            if (k !== 0)
                                continue;
                            else
                                ps2 = 1;
                        }
                        let ts = outSizes[i];
                        ps2 = Math.floor(ps2);
                        ts = Math.min(ts + ps2, max);
                        ps2 = ps - ps2;
                        dist -= (ts - outSizes[i]);
                        outSizes[i] = ts;
                    }
                    dist = Math.ceil(dist);
                    round++;
                }
            }
        }
        static refreshAllLayouts(caller) {
            let len = _dirtyLayouts.length;
            if (len === 0)
                return;
            if (caller) {
                for (let i = 0; i < len; i++) {
                    let layout = _dirtyLayouts[i];
                    if (layout && caller.isAncestorOf(layout._owner)) {
                        _dirtyLayouts[i] = null;
                        layout.refresh();
                    }
                }
            }
            else {
                _timerAdded = false;
                for (let i = 0; i < len; i++) {
                    let layout = _dirtyLayouts[i];
                    if (layout) {
                        _dirtyLayouts[i] = null;
                        layout.refresh();
                    }
                }
                if (_dirtyLayouts.length > len)
                    _dirtyLayouts.splice(0, len);
                else
                    _dirtyLayouts.length = 0;
            }
        }
    }
    var _timerAdded = false;
    var _dirtyLayouts = [];
    class TempData {
        constructor() {
            this.children = [];
            this.invisibles = [];
            this.invisibleCnt = 0;
            this.stretchParams = [];
            this.posx = [];
            this.posy = [];
            this.width = [];
            this.swidth = [];
            this.height = [];
            this.sheight = [];
        }
    }
    const tempDataPool = Laya.Pool.createPool(TempData);
    const limit = [];
    const s_rect$1 = new Laya.Rectangle();
    const defParam = new StretchParam();

    class GBox extends GWidget {
        constructor(layoutClass) {
            super();
            this._layout = new (layoutClass || Layout)(this);
        }
        get layout() {
            return this._layout;
        }
        setLayoutChangedFlag(reason) {
            var _a;
            (_a = this._layout) === null || _a === void 0 ? void 0 : _a.setChangedFlag(reason);
        }
        _sizeChanged(changeByLayout) {
            if (changeByLayout)
                this._layout.refresh();
        }
    }

    let _tmpInfo = { text: "" };
    function myT(resources, name, defaultValue, options) {
        if (typeof (defaultValue) === "object") {
            options = defaultValue;
            defaultValue = "";
        }
        let ent = resources[name];
        if (!ent)
            return defaultValue;
        if (options)
            return Laya.Utils.parseTemplate(ent, options);
        else
            return ent;
    }
    class SimpleProvider {
        constructor() {
            var _a;
            this.isInitialized = true;
            this.language = ((_a = window === null || window === void 0 ? void 0 : window.navigator) === null || _a === void 0 ? void 0 : _a.language) || "en";
            this._content = {};
            this._t = myT.bind(null, {});
        }
        t(name, defaultValue, options) {
            return this._t(name, defaultValue, options);
        }
        addResourceBundle(lng, ns, resources, deep, overwrite) {
            let col = this._content[lng];
            if (!col)
                col = this._content[lng] = {};
            let func = myT.bind(null, resources);
            if (lng === this.language)
                this._t = func;
            col[ns] = { resources, t: func };
        }
        removeResourceBundle(lng, ns) {
            let col = this._content[lng];
            if (col)
                delete col[ns];
        }
        getFixedT(lng, ns) {
            var _a;
            let col = (_a = this._content[lng]) === null || _a === void 0 ? void 0 : _a[ns];
            if (col)
                return col.t;
            else
                return this._t;
        }
    }
    class Translations extends Laya.Resource {
        static getById(id) {
            return Translations._allInsts.get(id) || null;
        }
        static create(id, fallbackLng) {
            return new Translations(id, fallbackLng);
        }
        static translate(text, options) {
            Translations.decodeI18nText(text, _tmpInfo);
            let i18n;
            if (_tmpInfo.sid)
                i18n = Translations.getById(_tmpInfo.sid);
            else if (_tmpInfo.key)
                i18n = Translations.provider;
            if (i18n)
                text = i18n.t(_tmpInfo.key, _tmpInfo.text, options !== null && options !== void 0 ? options : undefined);
            return text;
        }
        static decodeI18nText(text, out) {
            out = out || {};
            if (!text || !text.startsWith("i18n:")) {
                out.sid = null;
                out.key = null;
                out.text = text;
                return out;
            }
            let i = text.indexOf(":", 5);
            let j = text.indexOf("|", 5);
            if (i != -1) {
                out.sid = text.substring(5, i);
                if (j != -1) {
                    out.key = text.substring(i + 1, j);
                    out.text = text.substring(j + 1);
                }
                else {
                    out.key = text.substring(i + 1);
                    out.text = null;
                }
            }
            else if (j != -1) {
                out.sid = null;
                out.key = text.substring(5, j);
                out.text = text.substring(j + 1);
            }
            else {
                out.sid = null;
                out.key = text.substring(5);
                out.text = null;
            }
            return out;
        }
        static encodeI18nText(info, newText) {
            var _a;
            if (newText == null)
                newText = (_a = info.text) !== null && _a !== void 0 ? _a : "";
            if (!info.key)
                return newText;
            if (info.sid)
                return "i18n:" + info.sid + ":" + info.key + "|" + newText;
            else
                return "i18n:" + info.key + "|" + newText;
        }
        constructor(id, fallbackLng) {
            super(false);
            this._id2 = id;
            Translations._allInsts.set(id, this);
            this._lngs = [];
            this._fallbackLng = fallbackLng || "en";
        }
        get id() {
            return this._id;
        }
        setContent(lng, content) {
            let i18n = Translations.provider;
            if (!i18n || !i18n.isInitialized) {
                console.error("no i18n provider or i18 is not initialized");
                return this;
            }
            if (!lng)
                lng = i18n.language;
            Translations.provider.addResourceBundle(lng, this._id2, content, true, true);
            if (this._lngs.indexOf(lng) == -1)
                this._lngs.push(lng);
            if (lng == i18n.language)
                this._t = i18n.getFixedT(i18n.language, this._id2);
            else if (!this._t && lng == this._fallbackLng)
                this._t = i18n.getFixedT(this._fallbackLng, this._id2);
            return this;
        }
        t(name, arg0, arg1) {
            if (this._t)
                return this._t(name, arg0, arg1);
            else if (typeof (arg0) === "string")
                return arg0;
            else
                return name;
        }
        _disposeResource() {
            super._disposeResource();
            Translations._allInsts.delete(this._id2);
            for (let lng of this._lngs)
                Translations.provider.removeResourceBundle(lng, this._id2);
        }
    }
    Translations.provider = new SimpleProvider();
    Translations._allInsts = new Map();

    class GTextField extends GWidget {
        constructor() {
            super();
            this._fitContent = 0;
            this.textIns = new Laya.Text();
            this.textIns.hideFlags |= Laya.HideFlags.HideAndDontSave;
            this.textIns.padding.fill(2);
            this.textIns._onPostLayout = () => this._onPostLayout();
            this.textIns._onTranslate = Translations.translate;
            this.addChild(this.textIns);
        }
        get textWidth() {
            return this.textIns.textWidth;
        }
        get textHeight() {
            return this.textIns.textHeight;
        }
        get text() {
            return this.textIns.text;
        }
        set text(value) {
            this.textIns.text = value;
        }
        get font() {
            return this.textIns.font;
        }
        set font(value) {
            this.textIns.font = value;
        }
        get fontSize() {
            return this.textIns.fontSize;
        }
        set fontSize(value) {
            this.textIns.fontSize = value;
        }
        get color() {
            return this.textIns.color;
        }
        set color(value) {
            this.textIns.color = value;
        }
        get bold() {
            return this.textIns.bold;
        }
        set bold(value) {
            this.textIns.bold = value;
        }
        get italic() {
            return this.textIns.italic;
        }
        set italic(value) {
            this.textIns.italic = value;
        }
        get align() {
            return this.textIns.align;
        }
        set align(value) {
            this.textIns.align = value;
        }
        get valign() {
            return this.textIns.valign;
        }
        set valign(value) {
            this.textIns.valign = value;
        }
        get alignItems() {
            return this.textIns.alignItems;
        }
        set alignItems(value) {
            this.textIns.alignItems = value;
        }
        get wordWrap() {
            return this.textIns.wordWrap;
        }
        set wordWrap(value) {
            this.textIns.wordWrap = value;
        }
        get fitContent() {
            return this._fitContent;
        }
        set fitContent(value) {
            if (this._fitContent != value) {
                if ((value == exports.TextFitContent.Both || value == exports.TextFitContent.Height)
                    && !Laya.SerializeUtil.isDeserializing
                    && (!this._getBit(Laya.NodeFlags.EDITING_NODE) || this.textIns.textWidth > 0 && this.textIns.textHeight > 0)) {
                    if (value == exports.TextFitContent.Height)
                        this.height = this.textIns.textHeight;
                    else
                        this.size(this.textIns.textWidth, this.textIns.textHeight);
                }
                this._fitContent = value;
            }
        }
        get leading() {
            return this.textIns.leading;
        }
        set leading(value) {
            this.textIns.leading = value;
        }
        get letterSpacing() {
            return this.textIns.letterSpacing;
        }
        set letterSpacing(value) {
            this.textIns.letterSpacing = value;
        }
        get padding() {
            return this.textIns.padding;
        }
        set padding(value) {
            this.textIns.padding = value;
        }
        get stroke() {
            return this.textIns.stroke;
        }
        set stroke(value) {
            this.textIns.stroke = value;
        }
        get strokeColor() {
            return this.textIns.strokeColor;
        }
        set strokeColor(value) {
            this.textIns.strokeColor = value;
        }
        get shadowOffsetX() {
            return this.textIns.shadowOffsetX;
        }
        set shadowOffsetX(value) {
            this.textIns.shadowOffsetX = value;
        }
        get shadowOffsetY() {
            return this.textIns.shadowOffsetY;
        }
        set shadowOffsetY(value) {
            this.textIns.shadowOffsetY = value;
        }
        get shadowBlur() {
            return this.textIns.shadowBlur;
        }
        set shadowBlur(value) {
            this.textIns.shadowBlur = value;
        }
        get shadowColor() {
            return this.textIns.shadowColor;
        }
        set shadowColor(value) {
            this.textIns.shadowColor = value;
        }
        get overflow() {
            return this.textIns.overflow;
        }
        set overflow(value) {
            this.textIns.overflow = value;
        }
        get underline() {
            return this.textIns.underline;
        }
        set underline(value) {
            this.textIns.underline = value;
        }
        get underlineColor() {
            return this.textIns.underlineColor;
        }
        set underlineColor(value) {
            this.textIns.underlineColor = value;
        }
        get strikethrough() {
            return this.textIns.strikethrough;
        }
        set strikethrough(value) {
            this.textIns.strikethrough = value;
        }
        get strikethroughColor() {
            return this.textIns.strikethroughColor;
        }
        set strikethroughColor(value) {
            this.textIns.strikethroughColor = value;
        }
        get html() {
            return this.textIns.html;
        }
        set html(value) {
            this.textIns.html = value;
        }
        get ubb() {
            return this.textIns.ubb;
        }
        set ubb(value) {
            this.textIns.ubb = value;
        }
        get maxWidth() {
            return this.textIns.maxWidth;
        }
        set maxWidth(value) {
            this.textIns.maxWidth = value;
        }
        get singleCharRender() {
            return this.textIns.singleCharRender;
        }
        set singleCharRender(value) {
            this.textIns.singleCharRender = value;
        }
        get templateVars() {
            return this.textIns.templateVars;
        }
        set templateVars(value) {
            this.textIns.templateVars = value;
        }
        setVar(name, value) {
            this.textIns.setVar(name, value);
            return this;
        }
        size(width, height) {
            if (this._fitContent == exports.TextFitContent.Both && !this._fitFlag
                && (!this._getBit(Laya.NodeFlags.EDITING_NODE) || this.textIns.textWidth > 0))
                width = this._width;
            if ((this._fitContent == exports.TextFitContent.Both || this._fitContent == exports.TextFitContent.Height) && !this._fitFlag
                && (!this._getBit(Laya.NodeFlags.EDITING_NODE) || this.textIns.textHeight > 0))
                height = this._height;
            return super.size(width, height);
        }
        typeset(force) {
            this.textIns.typeset(force);
            return this;
        }
        _transChanged(kind) {
            super._transChanged(kind);
            if ((kind & Laya.TransformKind.Width) != 0)
                this.textIns.width = this._width;
            if ((kind & Laya.TransformKind.Height) != 0)
                this.textIns.height = this._height;
        }
        _onPostLayout() {
            if ((this._fitContent == exports.TextFitContent.Both || this._fitContent == exports.TextFitContent.Height)
                && (!this._getBit(Laya.NodeFlags.EDITING_NODE) || this.textIns.textWidth > 0 && this.textIns.textHeight > 0)) {
                this._fitFlag = true;
                if (this._fitContent == exports.TextFitContent.Height)
                    this.height = this.textIns.textHeight;
                else
                    this.size(this.textIns.textWidth, this.textIns.textHeight);
                this._fitFlag = false;
            }
        }
    }

    class GTextInput extends GWidget {
        constructor() {
            super();
            this.textIns = new Laya.Input();
            this.textIns.hideFlags |= Laya.HideFlags.HideAndDontSave;
            this.textIns.overflow = "hidden";
            this.textIns.padding.fill(2);
            this.textIns._onTranslate = (text, options, role) => role === 1 ? Translations.translate(text, options) : text;
            this.textIns.on(Laya.Event.INPUT, () => this.event(Laya.Event.INPUT));
            this.textIns.on(Laya.Event.ENTER, () => this.event(Laya.Event.ENTER));
            this.textIns.on(Laya.Event.CHANGE, () => this.event(Laya.Event.CHANGE));
            this.textIns.on(Laya.Event.FOCUS, () => this.event(Laya.Event.FOCUS));
            this.textIns.on(Laya.Event.BLUR, () => this.event(Laya.Event.BLUR));
            this.addChild(this.textIns);
        }
        get text() {
            return this.textIns.text;
        }
        set text(value) {
            this.textIns.text = value;
        }
        get font() {
            return this.textIns.font;
        }
        set font(value) {
            this.textIns.font = value;
        }
        get fontSize() {
            return this.textIns.fontSize;
        }
        set fontSize(value) {
            this.textIns.fontSize = value;
        }
        get color() {
            return this.textIns.color;
        }
        set color(value) {
            this.textIns.color = value;
        }
        get bold() {
            return this.textIns.bold;
        }
        set bold(value) {
            this.textIns.bold = value;
        }
        get italic() {
            return this.textIns.italic;
        }
        set italic(value) {
            this.textIns.italic = value;
        }
        get align() {
            return this.textIns.align;
        }
        set align(value) {
            this.textIns.align = value;
        }
        get valign() {
            return this.textIns.valign;
        }
        set valign(value) {
            this.textIns.valign = value;
        }
        get leading() {
            return this.textIns.leading;
        }
        set leading(value) {
            this.textIns.leading = value;
        }
        get padding() {
            return this.textIns.padding;
        }
        set padding(value) {
            this.textIns.padding = value;
        }
        get underline() {
            return this.textIns.underline;
        }
        set underline(value) {
            this.textIns.underline = value;
        }
        get underlineColor() {
            return this.textIns.underlineColor;
        }
        set underlineColor(value) {
            this.textIns.underlineColor = value;
        }
        get strikethrough() {
            return this.textIns.strikethrough;
        }
        set strikethrough(value) {
            this.textIns.strikethrough = value;
        }
        get strikethroughColor() {
            return this.textIns.strikethroughColor;
        }
        set strikethroughColor(value) {
            this.textIns.strikethroughColor = value;
        }
        get stroke() {
            return this.textIns.stroke;
        }
        set stroke(value) {
            this.textIns.stroke = value;
        }
        get strokeColor() {
            return this.textIns.strokeColor;
        }
        set strokeColor(value) {
            this.textIns.strokeColor = value;
        }
        get multiline() {
            return this.textIns.multiline;
        }
        set multiline(value) {
            this.textIns.multiline = value;
        }
        get editable() {
            return this.textIns.editable;
        }
        set editable(value) {
            this.textIns.editable = value;
        }
        get restrict() {
            return this.textIns.restrict;
        }
        set restrict(pattern) {
            this.textIns.restrict = pattern;
        }
        get prompt() {
            return this.textIns.prompt;
        }
        set prompt(value) {
            this.textIns.prompt = value;
        }
        get promptColor() {
            return this.textIns.promptColor;
        }
        set promptColor(value) {
            this.textIns.promptColor = value;
        }
        get maxChars() {
            return this.textIns.maxChars;
        }
        set maxChars(value) {
            this.textIns.maxChars = value;
        }
        get type() {
            return this.textIns.type;
        }
        set type(value) {
            this.textIns.type = value;
        }
        focus() {
            this.textIns.focus = true;
        }
        blur() {
            this.textIns.focus = false;
        }
        _transChanged(kind) {
            super._transChanged(kind);
            if ((kind & Laya.TransformKind.Size) != 0) {
                this.textIns.size(this.width, this.height);
            }
        }
    }

    class WidgetRef {
        static create(oldVal, target, callback) {
            if (oldVal)
                oldVal.destroy();
            if (target)
                return new WidgetRef(target, callback);
            else
                return null;
        }
        constructor(val, callback) {
            this.p = val;
            if (!Laya.LayaEnv.isPlaying) {
                val.on(exports.UIEvent.InstanceReload, this, this._reload);
                this._callback = callback;
            }
        }
        destroy() {
            if (!Laya.LayaEnv.isPlaying)
                this.p.off(exports.UIEvent.InstanceReload, this, this._reload);
        }
        _reload(newIns) {
            this.p = newIns;
            this._callback();
        }
    }

    class GLabel extends GWidget {
        get title() {
            if (this._titleWidget)
                return this._titleWidget.p.text;
            else
                return "";
        }
        set title(value) {
            if (this._titleWidget)
                this._titleWidget.p.text = value;
        }
        get text() {
            return this.title;
        }
        set text(value) {
            this.title = value;
        }
        get icon() {
            if (this._iconWidget)
                return this._iconWidget.p.icon;
            else
                return "";
        }
        set icon(value) {
            if (this._iconWidget)
                this._iconWidget.p.icon = value;
        }
        get titleColor() {
            let tf = this.findTextWidget();
            if (tf)
                return tf.color;
            else
                return "#000000";
        }
        set titleColor(value) {
            let tf = this.findTextWidget();
            if (tf)
                tf.color = value;
        }
        get titleFontSize() {
            let tf = this.findTextWidget();
            if (tf)
                return tf.fontSize;
            else
                return 0;
        }
        set titleFontSize(value) {
            let tf = this.findTextWidget();
            if (tf)
                tf.fontSize = value;
        }
        get titleWidget() {
            var _a;
            return ((_a = this._titleWidget) === null || _a === void 0 ? void 0 : _a.p) || null;
        }
        set titleWidget(val) {
            this._titleWidget = WidgetRef.create(this._titleWidget, val, () => this._onPartChanged("title"));
            this._onPartChanged("title");
        }
        get iconWidget() {
            var _a;
            return ((_a = this._iconWidget) === null || _a === void 0 ? void 0 : _a.p) || null;
        }
        set iconWidget(val) {
            this._iconWidget = WidgetRef.create(this._iconWidget, val, () => this._onPartChanged("icon"));
            this._onPartChanged("icon");
        }
        _onPartChanged(which) {
        }
        findTextWidget() {
            let p = this._titleWidget;
            while (p) {
                let pp = p.p;
                if ((pp instanceof GTextField) || (pp instanceof GTextInput))
                    return pp;
                if (pp instanceof GLabel)
                    p = pp._titleWidget;
                else
                    break;
            }
            return null;
        }
    }

    class GImage extends GWidget {
        constructor() {
            super();
            this._src = "";
            this._loadId = 0;
            this._color = "#ffffff";
            this._autoSize = true;
            this._renderer = new ImageRenderer(this);
            this._renderer._onReload = () => this.onTextureReload();
        }
        get src() {
            return this._src;
        }
        set src(value) {
            if (value == null)
                value = "";
            if (this._src == value)
                return;
            this._src = value;
            let loadID = ++this._loadId;
            if (value) {
                let tex = Laya.SerializeUtil.isDeserializing ? null : Laya.Loader.getRes(value);
                if (tex)
                    this.onLoaded(tex, loadID);
                else
                    Laya.ILaya.loader.load(value, Laya.Loader.IMAGE).then(res => this.onLoaded(res, loadID));
            }
            else
                this.onLoaded(null, loadID);
        }
        get texture() {
            return this._renderer._tex;
        }
        set texture(value) {
            this._src = "instance-0";
            this.onLoaded(value, ++this._loadId);
        }
        get mesh() {
            return this._renderer._meshFactory;
        }
        set mesh(value) {
            this._renderer.setMesh(value);
        }
        get icon() {
            return this.src;
        }
        set icon(value) {
            this.src = value;
        }
        get autoSize() {
            return this._autoSize;
        }
        set autoSize(value) {
            if (this._autoSize != value) {
                if (value && this._renderer._tex)
                    this.size(this._renderer._tex.sourceWidth, this._renderer._tex.sourceHeight);
                this._autoSize = value;
            }
        }
        get color() {
            return this._color;
        }
        set color(value) {
            this._color = value;
            this._renderer.setColor(value);
        }
        onLoaded(tex, loadID) {
            if (this._loadId != loadID || this.destroyed)
                return;
            this._renderer.setTexture(tex);
            if (this._autoSize) {
                if (tex)
                    this.size(tex.sourceWidth, tex.sourceHeight);
                else if (!this._getBit(Laya.NodeFlags.EDITING_NODE))
                    this.size(0, 0);
                this._autoSize = true;
            }
            this.event(Laya.Event.LOADED);
        }
        onTextureReload() {
            if (this._autoSize) {
                let tex = this._renderer._tex;
                this.size(tex.sourceWidth, tex.sourceHeight);
                this._autoSize = true;
            }
            this.event(Laya.Event.LOADED);
        }
        _sizeChanged(changeByLayout) {
            super._sizeChanged();
            if (!changeByLayout && !Laya.SerializeUtil.isDeserializing)
                this._autoSize = false;
        }
        destroy() {
            super.destroy();
            this._renderer.destroy();
        }
    }

    const ButtonPageAlternatives = {
        [exports.ButtonStatus.Over]: exports.ButtonStatus.Up,
        [exports.ButtonStatus.SelectedOver]: exports.ButtonStatus.Down,
        [exports.ButtonStatus.Disabled]: exports.ButtonStatus.Up,
        [exports.ButtonStatus.SelectedDisabled]: exports.ButtonStatus.Down,
    };
    const SaveColorSymbol = Symbol();
    var tmpColor;
    const downEffectValueC = 0.8;
    const downEffectValueS = 0.9;
    class GButton extends GLabel {
        constructor() {
            super();
            this._selected = false;
            this._titleStr = "";
            this._iconStr = "";
            this._selectedTitleStr = "";
            this._selectedIconStr = "";
            this._soundVolumeScale = 0;
            this._selectedPage = 0;
            this._downEffect = 0;
            this._scaleEffect = false;
            this._mode = exports.ButtonMode.Common;
            this._soundVolumeScale = 1;
            this._changeStateOnClick = true;
            this.on(Laya.Event.ROLL_OVER, this, this._rollover);
            this.on(Laya.Event.ROLL_OUT, this, this._rollout);
            this.on(Laya.Event.MOUSE_DOWN, this, this._btnTouchBegin);
            this.on(Laya.Event.MOUSE_UP, this, this._btnTouchEnd);
            this.on(Laya.Event.CLICK, this, this._click);
            this.on(Laya.Event.RIGHT_CLICK, this, this._rightClick);
            this.on(Laya.Event.UNDISPLAY, this, this._removeFromStage);
        }
        destroy() {
            if (this._selectedController)
                this._selectedController.release();
            super.destroy();
        }
        get title() {
            return this._titleStr;
        }
        set title(value) {
            if (value == null)
                value = "";
            this._titleStr = value;
            super.title = (this._selected && this._selectedTitleStr) ? this._selectedTitleStr : value;
        }
        get selectedTitle() {
            return this._selectedTitleStr;
        }
        set selectedTitle(value) {
            if (value == null)
                value = "";
            this._selectedTitleStr = value;
            super.title = (this._selected && this._selectedTitleStr) ? value : this._titleStr;
        }
        get icon() {
            return this._iconStr;
        }
        set icon(value) {
            if (value == null)
                value = "";
            this._iconStr = value;
            super.icon = (this._selected && this._selectedIconStr) ? this._selectedIconStr : value;
        }
        get selectedIcon() {
            return this._selectedIconStr;
        }
        set selectedIcon(value) {
            if (value == null)
                value = "";
            this._selectedIconStr = value;
            super.icon = (this._selected && this._selectedIconStr) ? value : this._iconStr;
        }
        get downEffect() {
            return this._downEffect;
        }
        set downEffect(value) {
            this._downEffect = value;
        }
        get sound() {
            return this._sound;
        }
        set sound(value) {
            this._sound = value;
        }
        get soundVolumeScale() {
            return this._soundVolumeScale;
        }
        set soundVolumeScale(value) {
            this._soundVolumeScale = value;
        }
        get selected() {
            return this._selected;
        }
        set selected(value) {
            if (this._mode == exports.ButtonMode.Common)
                return;
            if (this._selected != value) {
                this._selected = value;
                this.setCurrentState();
                if (this._selectedTitleStr && this._titleWidget)
                    this._titleWidget.p.text = this._selected ? this._selectedTitleStr : this._titleStr;
                if (this._selectedIconStr && this._iconWidget)
                    this._iconWidget.p.icon = this._selected ? this._selectedIconStr : this._iconStr;
                if (this._selectedController) {
                    if (this._selected) {
                        this._selectedController.selectedIndex = this._selectedPage;
                    }
                    else if (this._mode == exports.ButtonMode.Check && this._selectedController.selectedIndex == this._selectedPage)
                        this._selectedController.oppositeIndex = this._selectedPage;
                }
            }
        }
        get mode() {
            return this._mode;
        }
        set mode(value) {
            if (this._mode != value) {
                if (value == exports.ButtonMode.Common)
                    this.selected = false;
                this._mode = value;
            }
        }
        get selectedController() {
            return this._selectedController;
        }
        set selectedController(value) {
            if (this._selectedController)
                this._selectedController.release();
            this._selectedController = value;
            if (value) {
                value.validate();
                value.onChanged = this.selectChanged.bind(this);
                this.selectChanged();
            }
        }
        get selectedPage() {
            return this._selectedPage;
        }
        set selectedPage(value) {
            this._selectedPage = value;
            if (this._selectedController)
                this.selected = this._selectedPage == this._selectedController.selectedIndex;
        }
        get changeStateOnClick() {
            return this._changeStateOnClick;
        }
        set changeStateOnClick(value) {
            this._changeStateOnClick = value;
        }
        get mouseEnabled() {
            return super.mouseEnabled;
        }
        set mouseEnabled(value) {
            super.mouseEnabled = value;
            if (!this.mouseEnabled) {
                this._over = false;
                this.setCurrentState();
            }
        }
        fireClick(downEffect, clickCall) {
            if (this._mode !== exports.ButtonMode.Common)
                return;
            if (downEffect) {
                this.setState(exports.ButtonStatus.Over);
                Laya.Laya.timer.once(100, this, this.setState, [exports.ButtonStatus.Down]);
                Laya.Laya.timer.once(200, null, () => {
                    this.setState(exports.ButtonStatus.Up);
                    if (clickCall == null || clickCall)
                        this.event(Laya.Event.CLICK);
                });
            }
            else if (clickCall == null || clickCall)
                this.event(Laya.Event.CLICK);
        }
        setState(page) {
            if (this._buttonController) {
                if (page >= this._buttonController.numPages) {
                    page = ButtonPageAlternatives[page];
                    if (page == null)
                        return;
                }
                this._buttonController.selectedIndex = page;
            }
            if (this._downEffect == exports.ButtonDownEffect.Dark) {
                let isDown = page == exports.ButtonStatus.Down || page == exports.ButtonStatus.SelectedOver || page == exports.ButtonStatus.SelectedDisabled;
                if (!tmpColor)
                    tmpColor = new Laya.Color();
                for (let child of this.children) {
                    if (child instanceof GImage) {
                        if (isDown) {
                            child[SaveColorSymbol] = child.color;
                            tmpColor.parse(child.color);
                            tmpColor.r *= downEffectValueC;
                            tmpColor.g *= downEffectValueC;
                            tmpColor.b *= downEffectValueC;
                            child.color = tmpColor.toString();
                        }
                        else if (child[SaveColorSymbol])
                            child.color = child[SaveColorSymbol];
                    }
                }
            }
            else if (this._downEffect == exports.ButtonDownEffect.UpScale || this._downEffect == exports.ButtonDownEffect.DownScale) {
                let rate = this._downEffect == exports.ButtonDownEffect.DownScale ? downEffectValueS : 1 / downEffectValueS;
                if (page == exports.ButtonStatus.Down || page == exports.ButtonStatus.SelectedOver || page == exports.ButtonStatus.SelectedDisabled) {
                    if (!this._scaleEffect) {
                        this.scale(this.scaleX * rate, this.scaleY * rate);
                        this._scaleEffect = true;
                    }
                }
                else {
                    if (this._scaleEffect) {
                        this.scale(this.scaleX / rate, this.scaleY / rate);
                        this._scaleEffect = false;
                    }
                }
            }
        }
        setCurrentState() {
            if (this._selected)
                this.setState(this.grayed ? exports.ButtonStatus.SelectedDisabled : (this._over ? exports.ButtonStatus.SelectedOver : exports.ButtonStatus.Down));
            else
                this.setState(this.grayed ? exports.ButtonStatus.Disabled : (this._over ? exports.ButtonStatus.Over : exports.ButtonStatus.Up));
        }
        _controllersChanged() {
            super._controllersChanged();
            let c = this.getController("button");
            if (this._buttonController != c) {
                this._buttonController = c;
                this.setCurrentState();
            }
        }
        _onPartChanged(which) {
            if (which == "title") {
                if (this._titleStr)
                    this.title = this._titleStr;
            }
            else if (which == "icon") {
                if (this._iconStr)
                    this.icon = this._iconStr;
            }
        }
        selectChanged() {
            this.selected = this._selectedPage == this._selectedController.selectedIndex;
        }
        _rollover() {
            this._over = true;
            if (this._down)
                return;
            if (this.grayed)
                return;
            this.setState(this._selected ? exports.ButtonStatus.SelectedOver : exports.ButtonStatus.Over);
        }
        _rollout() {
            this._over = false;
            if (this._down)
                return;
            if (this.grayed)
                return;
            this.setState(this._selected ? exports.ButtonStatus.Down : exports.ButtonStatus.Up);
        }
        _btnTouchBegin(evt) {
            if (evt.button != 0)
                return;
            this._down = true;
            if (this._mode == exports.ButtonMode.Common) {
                this.setState(this.grayed ? exports.ButtonStatus.SelectedDisabled : exports.ButtonStatus.Down);
            }
        }
        _btnTouchEnd() {
            if (this._down) {
                this._down = false;
                if (this._mode == exports.ButtonMode.Common) {
                    this.setState(this.grayed ? exports.ButtonStatus.Disabled : (this._over ? exports.ButtonStatus.Over : exports.ButtonStatus.Up));
                }
                else {
                    if (!this._over
                        && this._buttonController
                        && (this._buttonController.selectedIndex == exports.ButtonStatus.Over || this._buttonController.selectedIndex == exports.ButtonStatus.SelectedOver)) {
                        this.setCurrentState();
                    }
                }
            }
        }
        _removeFromStage() {
            if (this._over)
                this._rollout();
        }
        _click(evt) {
            var _a;
            if (this._sound)
                Laya.SoundManager.playSound(this._sound).volume = this._soundVolumeScale;
            let ss = (_a = this.parent) === null || _a === void 0 ? void 0 : _a.selection;
            if (ss && ss.mode != exports.SelectionMode.None) {
                ss.handleClick(this, evt);
                if (this._mode != exports.ButtonMode.Common)
                    return;
            }
            if (this._mode == exports.ButtonMode.Check) {
                if (this._changeStateOnClick) {
                    this.selected = !this._selected;
                    this.event(Laya.Event.CHANGED);
                }
            }
            else if (this._mode == exports.ButtonMode.Radio) {
                if (this._changeStateOnClick && !this._selected) {
                    this.selected = true;
                    this.event(Laya.Event.CHANGED);
                }
            }
            else {
                if (this._selectedController)
                    this._selectedController.selectedIndex = this._selectedPage;
            }
        }
        _rightClick(evt) {
            let ss = this.parent.selection;
            if (ss && ss.mode != exports.SelectionMode.None) {
                ss.handleClick(this, evt);
            }
        }
    }

    class GComboBox extends GLabel {
        constructor() {
            super();
            this.popupDirection = 0;
            this.visibleItemCount = 0;
            this._itemsUpdated = true;
            this._selectedIndex = -1;
            this._items = [];
            this._icons = [];
            this._values = [];
            this.on(Laya.Event.ROLL_OVER, this, this._rollover);
            this.on(Laya.Event.ROLL_OUT, this, this._rollout);
            this.on(Laya.Event.MOUSE_DOWN, this, this._mousedown);
            this.on(Laya.Event.MOUSE_UP, this, this._mouseup);
        }
        get items() {
            return this._items;
        }
        set items(value) {
            let arr = this._items;
            arr.length = 0;
            if (value)
                arr.push(...value);
            this._itemsUpdated = true;
            if (Laya.SerializeUtil.isDeserializing) {
                if (arr.length > 0)
                    this._selectedIndex = 0;
                return;
            }
            if (arr.length > 0) {
                if (this._selectedIndex >= arr.length)
                    this._selectedIndex = arr.length - 1;
                else if (this._selectedIndex == -1)
                    this._selectedIndex = 0;
                this.title = arr[this._selectedIndex];
                if (this._selectedIndex < this._icons.length)
                    this.icon = this._icons[this._selectedIndex];
            }
            else {
                this.title = "";
                if (this._icons)
                    this.icon = null;
                this._selectedIndex = -1;
            }
        }
        get icons() {
            return this._icons;
        }
        set icons(value) {
            let arr = this._icons;
            arr.length = 0;
            if (value)
                arr.push(...value);
            this._itemsUpdated = true;
            if (Laya.SerializeUtil.isDeserializing)
                return;
            if (this._selectedIndex != -1 && this._selectedIndex < arr.length)
                this.icon = arr[this._selectedIndex];
        }
        get values() {
            return this._values;
        }
        set values(value) {
            this._values.length = 0;
            if (value)
                this._values.push(...value);
            this._itemsUpdated = true;
        }
        get selectedIndex() {
            return this._selectedIndex;
        }
        set selectedIndex(val) {
            var _a;
            if (this._selectedIndex === val && !this._itemsUpdated)
                return;
            this._selectedIndex = val;
            if (val >= 0 && val < this._items.length) {
                this.title = this._items[val];
                if (val < this._icons.length)
                    this.icon = this._icons[val];
            }
            else {
                this.title = "";
                if (this._icons)
                    this.icon = "";
            }
            let cc = (_a = this._selectedController) === null || _a === void 0 ? void 0 : _a.inst;
            if (cc != null && val >= 0 && val < cc.numPages && !cc.changing)
                this._selectedController.selectedIndex = val;
        }
        get value() {
            return this._values[this._selectedIndex];
        }
        set value(val) {
            let index = this._values.indexOf(val);
            if (index == -1 && val == null)
                index = this._values.indexOf("");
            this.selectedIndex = index;
        }
        get dropdownRes() {
            return this._dropdownRes;
        }
        set dropdownRes(value) {
            this._dropdownRes = value;
            if (!this._getBit(Laya.NodeFlags.EDITING_NODE))
                this.createDropdown();
        }
        get dropdown() {
            return this._dropdown;
        }
        get selectedController() {
            return this._selectedController;
        }
        set selectedController(value) {
            if (this._selectedController)
                this._selectedController.release();
            this._selectedController = value;
            if (value) {
                value.validate();
                value.onChanged = this.selectChanged.bind(this);
                this.selectChanged();
            }
        }
        destroy() {
            if (this._dropdown) {
                this._dropdown.destroy();
                this._dropdown = null;
            }
            if (this._selectedController)
                this._selectedController.release();
            super.destroy();
        }
        updateList() {
            if (!this._dropdown.stage)
                return;
            this._updateDropDown();
            this._list.layout.refresh();
            GRoot.inst.popupMgr.validatePopupPosition(this._dropdown, this, this.popupDirection);
        }
        createDropdown() {
            if (this._dropdown) {
                this._dropdown.destroy();
                this._dropdown = null;
                this._list = null;
            }
            if (this._dropdownRes) {
                this._dropdown = this._dropdownRes.create();
                this._list = this._dropdown.getChild("list");
                if (this._list == null) {
                    console.warn(this._dropdownRes.url + ": should container a list component named list.");
                    return;
                }
                this._list.on(exports.UIEvent.ClickItem, this, this._clickItem);
                this._list.addRelation(this._dropdown, exports.RelationType.Width);
                this._list.removeRelation(this._dropdown, exports.RelationType.Height);
                this._dropdown.addRelation(this._list, exports.RelationType.Height);
                this._dropdown.removeRelation(this._list, exports.RelationType.Width);
                this._dropdown.on(Laya.Event.UNDISPLAY, this, this._popupWinClosed);
            }
        }
        _controllersChanged() {
            super._controllersChanged();
            let c = this.getController("button");
            if (this._buttonController != c) {
                this._buttonController = c;
                if (this._buttonController.numPages > 0)
                    this.setCurrentState();
            }
        }
        selectChanged() {
            this.selectedIndex = this._selectedController.selectedIndex;
        }
        setState(page) {
            if (this._buttonController) {
                if (page >= this._buttonController.numPages) {
                    page = ButtonPageAlternatives[page];
                    if (page == null)
                        return;
                }
                this._buttonController.selectedIndex = page;
            }
        }
        setCurrentState() {
            let p = (this._dropdown && this._dropdown.displayedInStage) ? exports.ButtonStatus.Down : (this._over ? exports.ButtonStatus.Over : exports.ButtonStatus.Up);
            this.setState(this.grayed ? exports.ButtonStatus.Disabled : p);
        }
        showDropdown() {
            if (!this._dropdown) {
                this.setState(exports.ButtonStatus.Down);
                return;
            }
            if (GRoot.inst.popupMgr.isPopupJustClosed(this._dropdown))
                return;
            this.event(exports.UIEvent.Popup);
            if (this._itemsUpdated)
                this._updateDropDown();
            this._list.selection.index = -1;
            this._dropdown.width = this.width;
            this._list.layout.refresh();
            GRoot.inst.popupMgr.showPopup(this._dropdown, this, this.popupDirection);
            this.setState(exports.ButtonStatus.Down);
        }
        _updateDropDown() {
            this._itemsUpdated = false;
            this._list.removeChildrenToPool();
            let cnt = this._items.length;
            for (let i = 0; i < cnt; i++) {
                let item = this._list.addItemFromPool();
                item.name = i < this._values.length ? this._values[i] : "";
                item.text = this._items[i];
                item.icon = i < this._icons.length ? this._icons[i] : "";
            }
            this._list.resizeToFit(this.visibleItemCount > 0 ? this.visibleItemCount : UIConfig2.defaultComboBoxVisibleItemCount);
        }
        _popupWinClosed() {
            this.setCurrentState();
        }
        _clickItem(item) {
            GRoot.inst.popupMgr.hidePopup(this._dropdown);
            this._selectedIndex = -1;
            this.selectedIndex = this._list.getChildIndex(item);
            this.event(Laya.Event.CHANGED);
        }
        _rollover() {
            this._over = true;
            if (this._down || this._dropdown && this._dropdown.parent)
                return;
            this.setCurrentState();
        }
        _rollout() {
            this._over = false;
            if (this._down || this._dropdown && this._dropdown.parent)
                return;
            this.setCurrentState();
        }
        _mousedown(evt) {
            if (evt.target instanceof Laya.Input)
                return;
            this._down = true;
            this.showDropdown();
        }
        _mouseup() {
            if (this._down) {
                this._down = false;
                this.setCurrentState();
            }
        }
    }

    class WidgetPool {
        constructor() {
            this._count = 0;
            this._items = {};
        }
        clear() {
            for (let i in this._items) {
                let arr = this._items[i];
                arr.forEach(obj => obj.destroy());
            }
            this._items = {};
            this._count = 0;
        }
        get count() {
            return this._count;
        }
        get defaultRes() {
            return this._defaultRes;
        }
        set defaultRes(value) {
            var _a;
            (_a = this._defaultRes) === null || _a === void 0 ? void 0 : _a._removeReference();
            this._defaultRes = value;
            if (value) {
                value._addReference();
                if (!value.url)
                    value.url = "data:" + idCounter++;
            }
        }
        get defaultRuntime() {
            return this._defaultRuntime;
        }
        set defaultRuntime(value) {
            this._defaultRuntime = value;
            if (value)
                this._createOptions = { runtime: value };
            else
                this._createOptions = null;
        }
        take(url) {
            var _a;
            if (!url) {
                url = (_a = this._defaultRes) === null || _a === void 0 ? void 0 : _a.url;
                if (!url) {
                    console.warn("set defaultRes first!");
                    return null;
                }
            }
            let arr = this._items[url];
            if (arr && arr.length > 0) {
                this._count--;
                return arr.shift();
            }
            let ret;
            if (url.startsWith("data:"))
                ret = this._defaultRes.create(this._createOptions);
            else
                ret = Laya.Loader.getRes(url).create(this._createOptions);
            if (ret)
                ret.hideFlags |= (Laya.LayaEnv.isPlaying ? Laya.HideFlags.DontSave : Laya.HideFlags.HideAndDontSave);
            return ret;
        }
        recover(obj) {
            let url = obj.url;
            if (!url) {
                obj.destroy();
                return;
            }
            let arr = this._items[url];
            if (!arr) {
                arr = [];
                this._items[url] = arr;
            }
            this._count++;
            arr.push(obj);
        }
    }
    var idCounter = 0;

    class ListLayout extends Layout {
        constructor() {
            super(...arguments);
            this._lineItemCnt = 0;
            this._numItems = 0;
            this._itemSize = new Laya.Point();
            this._firstIndex = 0;
            this._changed = 0;
            this._itemInfoVer = 0;
        }
        get numItems() {
            if (this._virtual)
                return this._numItems;
            else
                return this._owner.children.length;
        }
        set numItems(value) {
            if (this._virtual) {
                if (this._owner.itemRenderer == null)
                    throw new Error("set itemRenderer first!");
                this._numItems = value;
                if (this._loop)
                    this._realNumItems = this._numItems * 6;
                else
                    this._realNumItems = this._numItems;
                let oldCount = this._items.length;
                if (this._realNumItems > oldCount) {
                    for (let i = oldCount; i < this._realNumItems; i++) {
                        let ii = { width: 0, height: 0, flag: 0 };
                        ii.width = this._itemSize.x;
                        ii.height = this._itemSize.y;
                        this._items.push(ii);
                    }
                }
                else {
                    for (let i = this._realNumItems; i < oldCount; i++)
                        this._items[i].selected = false;
                }
                if (this._changed !== 0)
                    Laya.ILaya.timer.clearCallLater(this, this._refreshVirtualList);
                this._refreshVirtualList();
            }
            else {
                let cnt = this._owner.children.length;
                if (value > cnt) {
                    for (let i = cnt; i < value; i++) {
                        if (this._owner.itemProvider)
                            this._owner.addItemFromPool(this._owner.itemProvider(i));
                        else
                            this._owner.addItemFromPool();
                    }
                }
                else {
                    this._owner.removeChildrenToPool(value, cnt);
                }
                if (this._owner.itemRenderer) {
                    for (let i = 0; i < value; i++)
                        this._owner.itemRenderer(i, this._owner.getChildAt(i));
                }
            }
        }
        get itemSize() {
            return this._itemSize;
        }
        set itemSize(value) {
            this._itemSize.setTo(value.x, value.y);
            if (this._virtual) {
                if (this._type === exports.LayoutType.SingleColumn || this._type === exports.LayoutType.FlowX)
                    this._owner.scroller.step = this._itemSize.y;
                else
                    this._owner.scroller.step = this._itemSize.x;
                this._changed = 2;
                Laya.ILaya.timer.callLater(this, this._refreshVirtualList);
            }
        }
        _setVirtual(loop) {
            if (this._virtual)
                return;
            this._virtual = true;
            this._loop = loop;
            this._items = [];
            this._itemSizes = [];
            this._owner.removeChildrenToPool();
            if (this._itemSize.x === 0 && this._itemSize.y === 0) {
                let obj = this._owner.getFromPool();
                if (obj == null) {
                    throw new Error("Virtual List must have a default list item resource.");
                }
                else {
                    this._itemSize.x = obj.width;
                    this._itemSize.y = obj.height;
                }
                this._owner.returnToPool(obj);
            }
            this._owner.itemPool.clear();
            if (this._type === exports.LayoutType.SingleColumn || this._type === exports.LayoutType.FlowX) {
                this._owner.scroller.step = this._itemSize.y;
                if (this._loop)
                    this._owner.scroller._loop = 2;
            }
            else {
                this._owner.scroller.step = this._itemSize.x;
                if (this._loop)
                    this._owner.scroller._loop = 1;
            }
            this._owner.on(exports.UIEvent.Scroll, this, this._scrolled);
            this._changed = 2;
            Laya.ILaya.timer.callLater(this, this._refreshVirtualList);
        }
        childIndexToItemIndex(index) {
            if (!this._virtual)
                return index;
            if (this._pageMode) {
                for (let i = this._firstIndex; i < this._realNumItems; i++) {
                    if (this._items[i].obj) {
                        index--;
                        if (index < 0)
                            return i;
                    }
                }
                return index;
            }
            else {
                index += this._firstIndex;
                if (this._loop && this._numItems > 0)
                    index = index % this._numItems;
                return index;
            }
        }
        itemIndexToChildIndex(index) {
            if (!this._virtual)
                return index;
            if (this._pageMode) {
                return this._owner.getChildIndex(this._items[index].obj);
            }
            else {
                if (this._loop && this._numItems > 0) {
                    let j = this._firstIndex % this._numItems;
                    if (index >= j)
                        index = index - j;
                    else
                        index = this._numItems - j + index;
                }
                else
                    index -= this._firstIndex;
                return index;
            }
        }
        shouldSnapToNext(dir, delta, size) {
            return dir < 0 && delta > UIConfig2.defaultScrollSnappingThreshold * size
                || dir > 0 && delta > (1 - UIConfig2.defaultScrollSnappingThreshold) * size
                || dir === 0 && delta > size / 2;
        }
        getSnappingPosition(xValue, yValue, xDir, yDir, resultPoint) {
            if (this._virtual) {
                if (!resultPoint)
                    resultPoint = new Laya.Point();
                if (this._type === exports.LayoutType.SingleColumn || (this._pageMode ? this._type === exports.LayoutType.FlowY : this._type === exports.LayoutType.FlowX)) {
                    let saved = yValue;
                    s_n = yValue;
                    let index = this.getIndexOnPos1(false);
                    yValue = s_n;
                    if (index < this._items.length && index < this._realNumItems) {
                        let size = this._items[index].height;
                        if (this.shouldSnapToNext(yDir, saved - yValue, size))
                            yValue += size + this._rowGap;
                    }
                }
                else {
                    let saved = xValue;
                    s_n = xValue;
                    let index = this.getIndexOnPos2(false);
                    xValue = s_n;
                    if (index < this._items.length && index < this._realNumItems) {
                        let size = this._items[index].width;
                        if (this.shouldSnapToNext(xDir, saved - xValue, size))
                            xValue += size + this._columnGap;
                    }
                }
                resultPoint.x = xValue;
                resultPoint.y = yValue;
                return resultPoint;
            }
            else
                return super.getSnappingPosition(xValue, yValue, xDir, yDir, resultPoint);
        }
        getRectByItemIndex(index) {
            if (!this._virtual || this._numItems === 0)
                return new Laya.Rectangle();
            this._checkVirtualList();
            if (index >= this._items.length)
                throw new Error("Invalid child index: " + index + ">" + this._items.length);
            if (this._loop)
                index = Math.floor(this._firstIndex / this._numItems) * this._numItems + index;
            let rect;
            let ii = this._items[index];
            let pos = 0;
            if (this._type === exports.LayoutType.SingleColumn || this._type === exports.LayoutType.FlowX) {
                for (let i = this._lineItemCnt - 1; i < index; i += this._lineItemCnt)
                    pos += this._items[i].height + this._rowGap;
                rect = new Laya.Rectangle(0, pos, this._itemSize.x, ii.height);
            }
            else {
                for (let i = this._lineItemCnt - 1; i < index; i += this._lineItemCnt)
                    pos += this._items[i].width + this._columnGap;
                rect = new Laya.Rectangle(pos, 0, ii.width, this._itemSize.y);
            }
            return rect;
        }
        setChangedFlag(reason) {
            super.setChangedFlag(reason);
            if (this._layoutChanged && reason == null && this._virtual) {
                this._changed = 2;
                Laya.ILaya.timer.callLater(this, this._refreshVirtualList);
            }
        }
        refresh(force) {
            if (!this._virtual)
                super.refresh(force);
        }
        _checkVirtualList() {
            if (this._changed !== 0) {
                this._refreshVirtualList();
                Laya.ILaya.timer.clearCallLater(this, this._refreshVirtualList);
            }
        }
        refreshVirtualList() {
            if (this._changed === 0)
                this._changed = 1;
            Laya.ILaya.timer.callLater(this, this._refreshVirtualList);
        }
        getColumns() {
            if (this._columns > 0)
                return this._columns;
            else
                return Math.max(1, Math.floor((this.viewWidth + this._columnGap) / (this._itemSize.x + this._columnGap)));
        }
        getRows() {
            if (this._rows > 0)
                return this._rows;
            else
                return Math.max(1, Math.floor((this.viewHeight + this._rowGap) / (this._itemSize.y + this._rowGap)));
        }
        _refreshVirtualList() {
            if (this._owner.destroyed)
                return;
            let layoutChanged = this._changed === 2;
            this._changed = 0;
            this._eventLocked = true;
            let vw = this.viewWidth;
            let vh = this.viewHeight;
            if (layoutChanged) {
                this._lineItemCnt = 1;
                this._lineItemCnt2 = 1;
                if (this._type === exports.LayoutType.FlowX) {
                    this._lineItemCnt = this.getColumns();
                    if (this._pageMode)
                        this._lineItemCnt2 = this.getRows();
                }
                else if (this._type === exports.LayoutType.FlowY) {
                    this._lineItemCnt = this.getRows();
                    if (this._pageMode)
                        this._lineItemCnt2 = this.getColumns();
                }
                this._itemSizes.length = 0;
                if (this._type === exports.LayoutType.SingleColumn || this._type === exports.LayoutType.FlowX) {
                    if (this._stretchX === exports.StretchMode.Stretch) {
                        for (let i = 0; i < this._lineItemCnt; i++)
                            this._itemSizes[i] = this._itemSize.x;
                        this.handleStrecth(vw, this._lineItemCnt, this._columnGap, this.stretchParamsX, this._itemSizes);
                    }
                }
                else {
                    if (this._stretchY === exports.StretchMode.Stretch) {
                        for (let i = 0; i < this._lineItemCnt; i++)
                            this._itemSizes[i] = this._itemSize.y;
                        this.handleStrecth(vh, this._lineItemCnt, this._rowGap, this.stretchParamsY, this._itemSizes);
                    }
                }
            }
            let ch = 0, cw = 0;
            if (this._realNumItems > 0) {
                let len = Math.ceil(this._realNumItems / this._lineItemCnt) * this._lineItemCnt;
                let len2 = Math.min(this._lineItemCnt, this._realNumItems);
                if (this._pageMode) {
                    let pageCount = Math.ceil(len / (this._lineItemCnt * this._lineItemCnt2));
                    if (this._type === exports.LayoutType.SingleRow || this._type === exports.LayoutType.FlowX) {
                        cw = pageCount * vw;
                        ch = vh;
                    }
                    else {
                        cw = vw;
                        ch = pageCount * vh;
                    }
                }
                else if (this._type === exports.LayoutType.SingleColumn || this._type === exports.LayoutType.FlowX) {
                    for (let i = 0; i < len; i += this._lineItemCnt)
                        ch += this._items[i].height + this._rowGap;
                    if (ch > 0)
                        ch -= this._rowGap;
                    if (this._stretchX === exports.StretchMode.Stretch)
                        cw = vw;
                    else {
                        for (let i = 0; i < len2; i++)
                            cw += this._items[i].width + this._columnGap;
                        if (cw > 0)
                            cw -= this._columnGap;
                    }
                }
                else {
                    for (let i = 0; i < len; i += this._lineItemCnt)
                        cw += this._items[i].width + this._columnGap;
                    if (cw > 0)
                        cw -= this._columnGap;
                    if (this._stretchY === exports.StretchMode.Stretch)
                        ch = vh;
                    else {
                        for (let i = 0; i < len2; i++)
                            ch += this._items[i].height + this._rowGap;
                        if (ch > 0)
                            ch -= this._rowGap;
                    }
                }
                this._offsetX = 0;
                this._offsetY = 0;
                if (cw < vw) {
                    if (this._align === 1)
                        this._offsetX = Math.floor((vw - cw) / 2);
                    else if (this._align === 2)
                        this._offsetX = vw - cw;
                    if (!this._owner.scroller)
                        this._offsetX += this._padding[3];
                }
                if (ch < vh) {
                    if (this._valign === 1)
                        this._offsetY = Math.floor((vh - ch) / 2);
                    else if (this._valign === 2)
                        this._offsetY = vh - ch;
                    if (!this._owner.scroller)
                        this._offsetY += this._padding[0];
                }
            }
            this.setContentSize(cw, ch);
            this._eventLocked = false;
            this.handleScroll(true);
        }
        _scrolled() {
            this.handleScroll(false);
        }
        getIndexOnPos1(forceUpdate) {
            if (this._realNumItems < this._lineItemCnt) {
                s_n = 0;
                return 0;
            }
            if (this._owner.numChildren > 0 && !forceUpdate) {
                let pos2 = this._owner.getChildAt(0).top;
                if (pos2 > s_n) {
                    for (let i = this._firstIndex - this._lineItemCnt; i >= 0; i -= this._lineItemCnt) {
                        pos2 -= (this._items[i].height + this._rowGap);
                        if (pos2 <= s_n) {
                            s_n = pos2;
                            return i;
                        }
                    }
                    s_n = 0;
                    return 0;
                }
                else {
                    for (let i = this._firstIndex; i < this._realNumItems; i += this._lineItemCnt) {
                        let pos3 = pos2 + this._items[i].height + this._rowGap;
                        if (pos3 > s_n) {
                            s_n = pos2;
                            return i;
                        }
                        pos2 = pos3;
                    }
                    s_n = pos2;
                    return this._realNumItems - this._lineItemCnt;
                }
            }
            else {
                let pos2 = 0;
                for (let i = 0; i < this._realNumItems; i += this._lineItemCnt) {
                    let pos3 = pos2 + this._items[i].height + this._rowGap;
                    if (pos3 > s_n) {
                        s_n = pos2;
                        return i;
                    }
                    pos2 = pos3;
                }
                s_n = pos2;
                return this._realNumItems - this._lineItemCnt;
            }
        }
        getIndexOnPos2(forceUpdate) {
            if (this._realNumItems < this._lineItemCnt) {
                s_n = 0;
                return 0;
            }
            if (this._owner.numChildren > 0 && !forceUpdate) {
                let pos2 = this._owner.getChildAt(0).left;
                if (pos2 > s_n) {
                    for (let i = this._firstIndex - this._lineItemCnt; i >= 0; i -= this._lineItemCnt) {
                        pos2 -= (this._items[i].width + this._columnGap);
                        if (pos2 <= s_n) {
                            s_n = pos2;
                            return i;
                        }
                    }
                    s_n = 0;
                    return 0;
                }
                else {
                    for (let i = this._firstIndex; i < this._realNumItems; i += this._lineItemCnt) {
                        let pos3 = pos2 + this._items[i].width + this._columnGap;
                        if (pos3 > s_n) {
                            s_n = pos2;
                            return i;
                        }
                        pos2 = pos3;
                    }
                    s_n = pos2;
                    return this._realNumItems - this._lineItemCnt;
                }
            }
            else {
                let pos2 = 0;
                for (let i = 0; i < this._realNumItems; i += this._lineItemCnt) {
                    let pos3 = pos2 + this._items[i].width + this._columnGap;
                    if (pos3 > s_n) {
                        s_n = pos2;
                        return i;
                    }
                    pos2 = pos3;
                }
                s_n = pos2;
                return this._realNumItems - this._lineItemCnt;
            }
        }
        getIndexOnPos3(forceUpdate) {
            if (this._realNumItems < this._lineItemCnt) {
                s_n = 0;
                return 0;
            }
            let vw = this.viewWidth;
            let page = Math.floor(s_n / vw);
            let startIndex = page * (this._lineItemCnt * this._lineItemCnt2);
            let pos2 = page * vw;
            for (let i = 0; i < this._lineItemCnt; i++) {
                let pos3 = pos2 + this._items[startIndex + i].width + this._columnGap;
                if (pos3 > s_n) {
                    s_n = pos2;
                    return startIndex + i;
                }
                pos2 = pos3;
            }
            s_n = pos2;
            return startIndex + this._lineItemCnt - 1;
        }
        getIndexOnPos4(forceUpdate) {
            if (this._realNumItems < this._lineItemCnt) {
                s_n = 0;
                return 0;
            }
            let vh = this.viewHeight;
            let page = Math.floor(s_n / vh);
            let startIndex = page * (this._lineItemCnt * this._lineItemCnt2);
            let pos2 = page * vh;
            for (let i = 0; i < this._lineItemCnt; i++) {
                let pos3 = pos2 + this._items[startIndex + i].height + this._rowGap;
                if (pos3 > s_n) {
                    s_n = pos2;
                    return startIndex + i;
                }
                pos2 = pos3;
            }
            s_n = pos2;
            return startIndex + this._lineItemCnt - 1;
        }
        handleScroll(forceUpdate) {
            if (this._eventLocked)
                return;
            if (this._pageMode) {
                if (this._type === exports.LayoutType.SingleRow || this._type === exports.LayoutType.FlowX)
                    this.handleScroll3(forceUpdate);
                else
                    this.handleScroll4(forceUpdate);
            }
            else if (this._type === exports.LayoutType.SingleColumn || this._type === exports.LayoutType.FlowX) {
                let enterCounter = 0;
                while (this.handleScroll1(forceUpdate)) {
                    enterCounter++;
                    forceUpdate = false;
                    if (enterCounter > 20) {
                        console.log("list will never be <the> filled item renderer function always returns a different size.");
                        break;
                    }
                }
            }
            else {
                let enterCounter = 0;
                while (this.handleScroll2(forceUpdate)) {
                    enterCounter++;
                    forceUpdate = false;
                    if (enterCounter > 20) {
                        console.log("list will never be <the> filled item renderer function always returns a different size.");
                        break;
                    }
                }
            }
            this._layoutChanged = false;
        }
        handleScroll1(forceUpdate) {
            let scroller = this._owner.scroller;
            let pos = scroller.scrollingPosY;
            let max = pos + scroller.viewHeight;
            let end = max === scroller.contentHeight;
            s_n = pos;
            let newFirstIndex = this.getIndexOnPos1(forceUpdate);
            pos = s_n;
            if (newFirstIndex === this._firstIndex && !forceUpdate)
                return false;
            let oldFirstIndex = this._firstIndex;
            this._firstIndex = newFirstIndex;
            let curIndex = newFirstIndex;
            let forward = oldFirstIndex > newFirstIndex;
            let childCount = this._owner.numChildren;
            let lastIndex = oldFirstIndex + childCount - 1;
            let reuseIndex = forward ? lastIndex : oldFirstIndex;
            let curX = 0, curY = pos;
            let needRender;
            let deltaSize = 0;
            let firstItemDeltaSize = 0;
            let pool = this._owner.itemPool;
            let url = pool.defaultRes.url;
            this._itemInfoVer++;
            while (curIndex < this._realNumItems && (end || curY < max)) {
                let ii = this._items[curIndex];
                if (ii.obj == null || forceUpdate) {
                    if (this._owner.itemProvider) {
                        url = this._owner.itemProvider(curIndex % this._numItems);
                        if (!url)
                            url = pool.defaultRes.url;
                    }
                    if (ii.obj && ii.obj.url != url) {
                        if (ii.obj instanceof GButton)
                            ii.selected = ii.obj.selected;
                        this._owner.removeChildToPool(ii.obj);
                        ii.obj = null;
                    }
                }
                if (ii.obj == null) {
                    if (forward) {
                        for (let j = reuseIndex; j >= oldFirstIndex; j--) {
                            let ii2 = this._items[j];
                            if (ii2.obj && ii2.flag !== this._itemInfoVer && ii2.obj.url == url) {
                                if (ii2.obj instanceof GButton)
                                    ii2.selected = ii2.obj.selected;
                                ii.obj = ii2.obj;
                                ii2.obj = null;
                                if (j === reuseIndex)
                                    reuseIndex--;
                                break;
                            }
                        }
                    }
                    else {
                        for (let j = reuseIndex; j <= lastIndex; j++) {
                            let ii2 = this._items[j];
                            if (ii2.obj && ii2.flag !== this._itemInfoVer && ii2.obj.url == url) {
                                if (ii2.obj instanceof GButton)
                                    ii2.selected = ii2.obj.selected;
                                ii.obj = ii2.obj;
                                ii2.obj = null;
                                if (j === reuseIndex)
                                    reuseIndex++;
                                break;
                            }
                        }
                    }
                    if (ii.obj) {
                        this._owner.setChildIndex(ii.obj, forward ? curIndex - newFirstIndex : this._owner.numChildren);
                    }
                    else {
                        ii.obj = pool.take(url);
                        if (forward)
                            this._owner.addChildAt(ii.obj, curIndex - newFirstIndex);
                        else
                            this._owner.addChild(ii.obj);
                    }
                    if (ii.obj instanceof GButton)
                        ii.obj.selected = ii.selected;
                    needRender = true;
                }
                else
                    needRender = forceUpdate;
                if (needRender) {
                    let k = curIndex % this._lineItemCnt;
                    if (this._stretchX === exports.StretchMode.Stretch)
                        ii.obj.size(this._itemSizes[k], ii.obj.height);
                    this._owner.itemRenderer(curIndex % this._numItems, ii.obj);
                    Layout.refreshAllLayouts(this._owner);
                    if (k === 0) {
                        deltaSize += Math.ceil(ii.obj.height) - ii.height;
                        if (curIndex === newFirstIndex && oldFirstIndex > newFirstIndex) {
                            firstItemDeltaSize = Math.ceil(ii.obj.height) - ii.height;
                        }
                    }
                    ii.width = Math.ceil(ii.obj.width);
                    ii.height = Math.ceil(ii.obj.height);
                }
                ii.flag = this._itemInfoVer;
                ii.obj.setLeftTop(this._offsetX + curX, curY);
                if (curIndex === newFirstIndex)
                    max += ii.height;
                curX += ii.width + this._columnGap;
                if (curIndex % this._lineItemCnt === this._lineItemCnt - 1) {
                    curX = 0;
                    curY += ii.height + this._rowGap;
                }
                curIndex++;
            }
            for (let i = 0; i < childCount; i++) {
                let ii = this._items[oldFirstIndex + i];
                if (ii.flag !== this._itemInfoVer && ii.obj) {
                    if (ii.obj instanceof GButton)
                        ii.selected = ii.obj.selected;
                    this._owner.removeChildToPool(ii.obj);
                    ii.obj = null;
                }
            }
            childCount = this._owner.children.length;
            let maxWidth = 0;
            for (let i = 0; i < childCount; i++) {
                let obj = this._items[newFirstIndex + i].obj;
                if (this._owner.children[i] != obj)
                    this._owner.setChildIndex(obj, i);
                let w = obj.width;
                if (w > maxWidth)
                    maxWidth = w;
            }
            let deltaWidth = 0;
            let checkOverflow;
            if (this._type === exports.LayoutType.SingleColumn && (checkOverflow = scroller._shouldCheckOverflow()) !== 0) {
                let resize;
                if ((checkOverflow & 2) !== 0) {
                    deltaWidth = maxWidth - scroller.contentWidth;
                    resize = Math.abs(deltaWidth) >= 1;
                }
                if ((checkOverflow & 1) !== 0 && scroller.contentHeight < scroller.viewHeight && maxWidth <= scroller.viewWidth) {
                    maxWidth = scroller.viewWidth + scroller.vScrollBar.width;
                    resize = true;
                }
                if (resize) {
                    for (let i = 0; i < childCount; i++) {
                        let obj = this._owner.children[i];
                        obj.width = maxWidth;
                    }
                }
            }
            if (deltaWidth !== 0 || deltaSize !== 0 || firstItemDeltaSize !== 0)
                scroller._changeContentSizeOnScrolling(deltaWidth, deltaSize, 0, firstItemDeltaSize);
            if (curIndex > 0 && this._owner.numChildren > 0 && this._owner._$container.y <= 0 && this._owner.getChildAt(0).top > -this._owner._$container.y)
                return true;
            else
                return false;
        }
        handleScroll2(forceUpdate) {
            let pos = this._owner.scroller.scrollingPosX;
            let max = pos + this._owner.scroller.viewWidth;
            let end = max === this._owner.scroller.contentWidth;
            s_n = pos;
            let newFirstIndex = this.getIndexOnPos2(forceUpdate);
            pos = s_n;
            if (newFirstIndex === this._firstIndex && !forceUpdate)
                return false;
            let oldFirstIndex = this._firstIndex;
            this._firstIndex = newFirstIndex;
            let curIndex = newFirstIndex;
            let forward = oldFirstIndex > newFirstIndex;
            let childCount = this._owner.numChildren;
            let lastIndex = oldFirstIndex + childCount - 1;
            let reuseIndex = forward ? lastIndex : oldFirstIndex;
            let curX = pos, curY = 0;
            let needRender;
            let deltaSize = 0;
            let firstItemDeltaSize = 0;
            let pool = this._owner.itemPool;
            let url = pool.defaultRes.url;
            this._itemInfoVer++;
            while (curIndex < this._realNumItems && (end || curX < max)) {
                let ii = this._items[curIndex];
                if (ii.obj == null || forceUpdate) {
                    if (this._owner.itemProvider) {
                        url = this._owner.itemProvider(curIndex % this._numItems);
                        if (!url)
                            url = pool.defaultRes.url;
                    }
                    if (ii.obj && ii.obj.url != url) {
                        if (ii.obj instanceof GButton)
                            ii.selected = ii.obj.selected;
                        this._owner.removeChildToPool(ii.obj);
                        ii.obj = null;
                    }
                }
                if (ii.obj == null) {
                    if (forward) {
                        for (let j = reuseIndex; j >= oldFirstIndex; j--) {
                            let ii2 = this._items[j];
                            if (ii2.obj && ii2.flag !== this._itemInfoVer && ii2.obj.url == url) {
                                if (ii2.obj instanceof GButton)
                                    ii2.selected = ii2.obj.selected;
                                ii.obj = ii2.obj;
                                ii2.obj = null;
                                if (j === reuseIndex)
                                    reuseIndex--;
                                break;
                            }
                        }
                    }
                    else {
                        for (let j = reuseIndex; j <= lastIndex; j++) {
                            let ii2 = this._items[j];
                            if (ii2.obj && ii2.flag !== this._itemInfoVer && ii2.obj.url == url) {
                                if (ii2.obj instanceof GButton)
                                    ii2.selected = ii2.obj.selected;
                                ii.obj = ii2.obj;
                                ii2.obj = null;
                                if (j === reuseIndex)
                                    reuseIndex++;
                                break;
                            }
                        }
                    }
                    if (ii.obj) {
                        this._owner.setChildIndex(ii.obj, forward ? curIndex - newFirstIndex : this._owner.numChildren);
                    }
                    else {
                        ii.obj = pool.take(url);
                        if (forward)
                            this._owner.addChildAt(ii.obj, curIndex - newFirstIndex);
                        else
                            this._owner.addChild(ii.obj);
                    }
                    if (ii.obj instanceof GButton)
                        ii.obj.selected = ii.selected;
                    needRender = true;
                }
                else
                    needRender = forceUpdate;
                if (needRender) {
                    let k = curIndex % this._lineItemCnt;
                    if (this._stretchY === exports.StretchMode.Stretch)
                        ii.obj.size(ii.obj.width, this._itemSizes[k]);
                    this._owner.itemRenderer(curIndex % this._numItems, ii.obj);
                    Layout.refreshAllLayouts(this._owner);
                    if (k == 0) {
                        deltaSize += Math.ceil(ii.obj.width) - ii.width;
                        if (curIndex === newFirstIndex && oldFirstIndex > newFirstIndex) {
                            firstItemDeltaSize = Math.ceil(ii.obj.width) - ii.width;
                        }
                    }
                    ii.width = Math.ceil(ii.obj.width);
                    ii.height = Math.ceil(ii.obj.height);
                }
                ii.flag = this._itemInfoVer;
                ii.obj.setLeftTop(curX, this._offsetY + curY);
                if (curIndex === newFirstIndex)
                    max += ii.width;
                curY += ii.height + this._rowGap;
                if (curIndex % this._lineItemCnt === this._lineItemCnt - 1) {
                    curY = 0;
                    curX += ii.width + this._columnGap;
                }
                curIndex++;
            }
            for (let i = 0; i < childCount; i++) {
                let ii = this._items[oldFirstIndex + i];
                if (ii.flag !== this._itemInfoVer && ii.obj) {
                    if (ii.obj instanceof GButton)
                        ii.selected = ii.obj.selected;
                    this._owner.removeChildToPool(ii.obj);
                    ii.obj = null;
                }
            }
            childCount = this._owner.numChildren;
            for (let i = 0; i < childCount; i++) {
                let obj = this._items[newFirstIndex + i].obj;
                if (this._owner.children[i] != obj)
                    this._owner.setChildIndex(obj, i);
            }
            if (deltaSize !== 0 || firstItemDeltaSize !== 0)
                this._owner.scroller._changeContentSizeOnScrolling(deltaSize, 0, firstItemDeltaSize, 0);
            if (curIndex > 0 && this._owner.numChildren > 0 && this._owner._$container.x <= 0 && this._owner.getChildAt(0).left > -this._owner._$container.x)
                return true;
            else
                return false;
        }
        handleScroll3(forceUpdate) {
            let pos = this._owner.scroller.scrollingPosX;
            s_n = pos;
            let newFirstIndex = this.getIndexOnPos3(forceUpdate);
            pos = s_n;
            if (newFirstIndex === this._firstIndex && !forceUpdate)
                return;
            let oldFirstIndex = this._firstIndex;
            this._firstIndex = newFirstIndex;
            let reuseIndex = oldFirstIndex;
            let virtualItemCount = this._items.length;
            let pageSize = this._lineItemCnt * this._lineItemCnt2;
            let startCol = newFirstIndex % this._lineItemCnt;
            let vw = this.viewWidth;
            let vh = this.viewHeight;
            let page = Math.floor(newFirstIndex / pageSize);
            let startIndex = page * pageSize;
            let lastIndex = startIndex + pageSize * 2;
            let needRender;
            let partWidth, partHeight;
            if (this._stretchX === exports.StretchMode.Stretch || this._stretchY === exports.StretchMode.Stretch) {
                if (this._lineItemCnt === this._columns)
                    partWidth = (vw - this._columnGap * (this._lineItemCnt - 1)) / this._lineItemCnt;
                if (this._lineItemCnt2 === this._rows)
                    partHeight = (vh - this._rowGap * (this._lineItemCnt2 - 1)) / this._lineItemCnt2;
            }
            let pool = this._owner.itemPool;
            let url = pool.defaultRes.url;
            this._itemInfoVer++;
            for (let i = startIndex; i < lastIndex; i++) {
                if (i >= this._realNumItems)
                    continue;
                let col = i % this._lineItemCnt;
                if (i - startIndex < pageSize) {
                    if (col < startCol)
                        continue;
                }
                else {
                    if (col > startCol)
                        continue;
                }
                this._items[i].flag = this._itemInfoVer;
            }
            let lastObj = null;
            let insertIndex = 0;
            for (let i = startIndex; i < lastIndex; i++) {
                if (i >= this._realNumItems)
                    continue;
                let ii = this._items[i];
                if (ii.flag !== this._itemInfoVer)
                    continue;
                if (ii.obj == null) {
                    while (reuseIndex < virtualItemCount) {
                        let ii2 = this._items[reuseIndex];
                        if (ii2.obj && ii2.flag !== this._itemInfoVer) {
                            if (ii2.obj instanceof GButton)
                                ii2.selected = ii2.obj.selected;
                            ii.obj = ii2.obj;
                            ii2.obj = null;
                            break;
                        }
                        reuseIndex++;
                    }
                    if (insertIndex === -1)
                        insertIndex = this._owner.getChildIndex(lastObj) + 1;
                    if (ii.obj == null) {
                        if (this._owner.itemProvider) {
                            url = this._owner.itemProvider(i % this._numItems);
                            if (!url)
                                url = pool.defaultRes.url;
                        }
                        ii.obj = pool.take(url);
                        this._owner.addChildAt(ii.obj, insertIndex);
                    }
                    else {
                        insertIndex = this._owner.setChildIndexBefore(ii.obj, insertIndex);
                    }
                    insertIndex++;
                    if (ii.obj instanceof GButton)
                        ii.obj.selected = ii.selected;
                    needRender = true;
                }
                else {
                    needRender = forceUpdate;
                    insertIndex = -1;
                    lastObj = ii.obj;
                }
                if (needRender) {
                    if (partWidth != null || partHeight != null)
                        ii.obj.size(partWidth !== null && partWidth !== void 0 ? partWidth : ii.obj.width, partHeight !== null && partHeight !== void 0 ? partHeight : ii.obj.height);
                    this._owner.itemRenderer(i % this._numItems, ii.obj);
                    Layout.refreshAllLayouts(this._owner);
                    ii.width = Math.ceil(ii.obj.width);
                    ii.height = Math.ceil(ii.obj.height);
                }
            }
            let borderX = (startIndex / pageSize) * vw;
            let xx = borderX;
            let yy = 0;
            let lineHeight = 0;
            for (let i = startIndex; i < lastIndex; i++) {
                if (i >= this._realNumItems)
                    continue;
                let ii = this._items[i];
                if (ii.flag === this._itemInfoVer)
                    ii.obj.setLeftTop(xx, yy);
                if (ii.height > lineHeight)
                    lineHeight = ii.height;
                if (i % this._lineItemCnt === this._lineItemCnt - 1) {
                    xx = borderX;
                    yy += lineHeight + this._rowGap;
                    lineHeight = 0;
                    if (i === startIndex + pageSize - 1) {
                        borderX += vw;
                        xx = borderX;
                        yy = 0;
                    }
                }
                else
                    xx += ii.width + this._columnGap;
            }
            for (let i = reuseIndex; i < virtualItemCount; i++) {
                let ii = this._items[i];
                if (ii.flag !== this._itemInfoVer && ii.obj) {
                    if (ii.obj instanceof GButton)
                        ii.selected = ii.obj.selected;
                    this._owner.removeChildToPool(ii.obj);
                    ii.obj = null;
                }
            }
        }
        handleScroll4(forceUpdate) {
            let pos = this._owner.scroller.scrollingPosY;
            s_n = pos;
            let newFirstIndex = this.getIndexOnPos4(forceUpdate);
            pos = s_n;
            if (newFirstIndex === this._firstIndex && !forceUpdate)
                return;
            let oldFirstIndex = this._firstIndex;
            this._firstIndex = newFirstIndex;
            let reuseIndex = oldFirstIndex;
            let virtualItemCount = this._items.length;
            let pageSize = this._lineItemCnt * this._lineItemCnt2;
            let startRow = newFirstIndex % this._lineItemCnt;
            let vw = this.viewWidth;
            let vh = this.viewHeight;
            let page = Math.floor(newFirstIndex / pageSize);
            let startIndex = page * pageSize;
            let lastIndex = startIndex + pageSize * 2;
            let needRender;
            let partWidth, partHeight;
            if (this._stretchX === exports.StretchMode.Stretch || this._stretchY === exports.StretchMode.Stretch) {
                if (this._lineItemCnt2 === this._columns)
                    partWidth = (vw - this._columnGap * (this._lineItemCnt2 - 1)) / this._lineItemCnt2;
                if (this._lineItemCnt === this._rows)
                    partHeight = (vh - this._rowGap * (this._lineItemCnt - 1)) / this._lineItemCnt;
            }
            let pool = this._owner.itemPool;
            let url = pool.defaultRes.url;
            this._itemInfoVer++;
            for (let i = startIndex; i < lastIndex; i++) {
                if (i >= this._realNumItems)
                    continue;
                let col = i % this._lineItemCnt;
                if (i - startIndex < pageSize) {
                    if (col < startRow)
                        continue;
                }
                else {
                    if (col > startRow)
                        continue;
                }
                let ii = this._items[i];
                ii.flag = this._itemInfoVer;
            }
            let lastObj = null;
            let insertIndex = 0;
            for (let i = startIndex; i < lastIndex; i++) {
                if (i >= this._realNumItems)
                    continue;
                let ii = this._items[i];
                if (ii.flag !== this._itemInfoVer)
                    continue;
                if (ii.obj == null) {
                    while (reuseIndex < virtualItemCount) {
                        let ii2 = this._items[reuseIndex];
                        if (ii2.obj && ii2.flag !== this._itemInfoVer) {
                            if (ii2.obj instanceof GButton)
                                ii2.selected = ii2.obj.selected;
                            ii.obj = ii2.obj;
                            ii2.obj = null;
                            break;
                        }
                        reuseIndex++;
                    }
                    if (insertIndex === -1)
                        insertIndex = this._owner.getChildIndex(lastObj) + 1;
                    if (ii.obj == null) {
                        if (this._owner.itemProvider) {
                            url = this._owner.itemProvider(i % this._numItems);
                            if (!url)
                                url = pool.defaultRes.url;
                        }
                        ii.obj = pool.take(url);
                        this._owner.addChildAt(ii.obj, insertIndex);
                    }
                    else {
                        insertIndex = this._owner.setChildIndexBefore(ii.obj, insertIndex);
                    }
                    insertIndex++;
                    if (ii.obj instanceof GButton)
                        ii.obj.selected = ii.selected;
                    needRender = true;
                }
                else {
                    needRender = forceUpdate;
                    insertIndex = -1;
                    lastObj = ii.obj;
                }
                if (needRender) {
                    if (partWidth != null || partHeight != null)
                        ii.obj.size(partWidth !== null && partWidth !== void 0 ? partWidth : ii.obj.width, partHeight !== null && partHeight !== void 0 ? partHeight : ii.obj.height);
                    this._owner.itemRenderer(i % this._numItems, ii.obj);
                    Layout.refreshAllLayouts(this._owner);
                    ii.width = Math.ceil(ii.obj.width);
                    ii.height = Math.ceil(ii.obj.height);
                }
            }
            let borderY = (startIndex / pageSize) * vh;
            let xx = 0;
            let yy = borderY;
            let lineWidth = 0;
            for (let i = startIndex; i < lastIndex; i++) {
                if (i >= this._realNumItems)
                    continue;
                let ii = this._items[i];
                if (ii.flag === this._itemInfoVer)
                    ii.obj.setLeftTop(xx, yy);
                if (ii.width > lineWidth)
                    lineWidth = ii.width;
                if (i % this._lineItemCnt === this._lineItemCnt - 1) {
                    xx += lineWidth + this._columnGap;
                    yy = borderY;
                    lineWidth = 0;
                    if (i === startIndex + pageSize - 1) {
                        borderY += vh;
                        xx = 0;
                        yy = borderY;
                    }
                }
                else
                    yy += ii.height + this._rowGap;
            }
            for (let i = reuseIndex; i < virtualItemCount; i++) {
                let ii = this._items[i];
                if (ii.flag !== this._itemInfoVer && ii.obj) {
                    if (ii.obj instanceof GButton)
                        ii.selected = ii.obj.selected;
                    this._owner.removeChildToPool(ii.obj);
                    ii.obj = null;
                }
            }
        }
    }
    let s_n = 0;

    class Selection {
        constructor(owner) {
            this.scrollItemToViewOnClick = false;
            this.allowSelectByRightClick = true;
            this._mode = 0;
            this._lastIndex = 0;
            this._owner = owner;
            this._lastIndex = -1;
        }
        get mode() {
            return this._mode;
        }
        set mode(value) {
            this._mode = value;
        }
        get index() {
            return this._owner.children.findIndex(obj => (obj instanceof GButton) && obj.selected);
        }
        set index(value) {
            if (value >= 0 && value < this._owner.numChildren) {
                if (this._mode != exports.SelectionMode.Single)
                    this.clear();
                this.add(value);
            }
            else
                this.clear();
        }
        get controller() {
            return this._controller;
        }
        set controller(value) {
            if (this._controller)
                this._controller.release();
            this._controller = value;
            if (value) {
                value.validate();
                value.onChanged = this.selectChanged.bind(this);
                this.selectChanged();
            }
        }
        get(out) {
            if (!out)
                out = [];
            for (let i = 0, cnt = this._owner.children.length; i < cnt; i++) {
                let obj = this._owner.children[i];
                if ((obj instanceof GButton) && obj.selected)
                    out.push(i);
            }
            return out;
        }
        add(index, scrollItToView) {
            var _a;
            if (this._mode == exports.SelectionMode.Disabled)
                return;
            if (this._mode == exports.SelectionMode.Single)
                this.clear();
            if (scrollItToView)
                (_a = this._owner.scroller) === null || _a === void 0 ? void 0 : _a.scrollTo(index);
            this._lastIndex = index;
            let obj;
            if (this._owner._getBit(Laya.NodeFlags.EDITING_NODE))
                obj = this._owner.children.filter(child => !child._extra.isTemplateNode)[index];
            else
                obj = this._owner.getChildAt(index);
            if ((obj instanceof GButton) && !obj.selected)
                obj.selected = true;
            this.syncController(index);
        }
        remove(index) {
            if (this._mode == exports.SelectionMode.Disabled)
                return;
            let obj;
            if (this._owner._getBit(Laya.NodeFlags.EDITING_NODE))
                obj = this._owner.children.filter(child => !child._extra.isTemplateNode)[index];
            else
                obj = this._owner.getChildAt(index);
            if (obj instanceof GButton)
                obj.selected = false;
        }
        clear() {
            for (let obj of this._owner.children) {
                if ((obj instanceof GButton) && !obj._extra.isTemplateNode)
                    obj.selected = false;
            }
        }
        clearExcept(g) {
            for (let obj of this._owner.children) {
                if ((obj instanceof GButton) && obj != g && !obj._extra.isTemplateNode)
                    obj.selected = false;
            }
        }
        selectAll() {
            for (let obj of this._owner.children) {
                if ((obj instanceof GButton) && !obj.selected) {
                    obj.selected = true;
                }
            }
        }
        selectReverse() {
            for (let obj of this._owner.children) {
                if (obj instanceof GButton) {
                    obj.selected = !obj.selected;
                }
            }
        }
        enableFocusEvents(enabled) {
            if (this._triggerFocusEvents == enabled)
                return;
            this._triggerFocusEvents = enabled;
        }
        handleFocus(evt) {
            let eventType = evt.type == "focus_in" ? "list_focus_in" : "list_focus_out";
            for (let obj of this._owner.children) {
                if ((obj instanceof GButton) && obj.selected)
                    obj.event(eventType);
            }
        }
        handleClick(item, evt) {
            let scroller = this._owner.scroller;
            if (scroller === null || scroller === void 0 ? void 0 : scroller.isDragged)
                return;
            if (evt.button == 2 && !this.allowSelectByRightClick)
                return;
            if (item.mode == exports.ButtonMode.Common) {
                this._owner.event(exports.UIEvent.ClickItem, [item, evt]);
                return;
            }
            let dontChangeLastIndex = false;
            let index = this._owner.getChildIndex(item);
            if (this._mode == exports.SelectionMode.Disabled) ;
            else if (this._mode == exports.SelectionMode.Single) {
                if (!item.selected) {
                    this.clearExcept(item);
                    item.selected = true;
                    item.event(Laya.Event.CHANGED);
                }
            }
            else {
                if (evt.shiftKey) {
                    if (!item.selected) {
                        if (this._lastIndex != -1) {
                            let min = Math.min(this._lastIndex, index);
                            let max = Math.max(this._lastIndex, index);
                            max = Math.min(max, this._owner.numChildren - 1);
                            for (let i = min; i <= max; i++) {
                                let obj = this._owner.getChildAt(i);
                                if (obj instanceof GButton) {
                                    obj.selected = true;
                                    if (obj == item)
                                        item.event(Laya.Event.CHANGED);
                                }
                            }
                            dontChangeLastIndex = true;
                        }
                        else {
                            item.selected = true;
                            item.event(Laya.Event.CHANGED);
                        }
                    }
                }
                else if ((evt.ctrlKey || evt.metaKey) || this._mode == exports.SelectionMode.MultipleBySingleClick) {
                    item.selected = !item.selected;
                    item.event(Laya.Event.CHANGED);
                }
                else {
                    if (!item.selected) {
                        this.clearExcept(item);
                        item.selected = true;
                        item.event(Laya.Event.CHANGED);
                    }
                    else if (evt.button == 0)
                        this.clearExcept(item);
                }
            }
            if (!dontChangeLastIndex)
                this._lastIndex = index;
            if (scroller && this.scrollItemToViewOnClick)
                scroller.scrollTo(item, true);
            if (item.selected)
                this.syncController(index);
            if (evt.isDblClick && (evt.target instanceof Laya.Input))
                return;
            this._owner.event(exports.UIEvent.ClickItem, [item, evt]);
        }
        enableArrowKeyNavigation(enabled, keySelectEvent) {
            if (enabled) {
                this._keyEvent = keySelectEvent != null ? keySelectEvent : exports.UIEvent.ClickItem;
                this._owner.on(Laya.Event.KEY_DOWN, this, this._keydown);
            }
            else {
                this._owner.off(Laya.Event.KEY_DOWN, this, this._keydown);
            }
        }
        _keydown(evt) {
            if ((evt.target instanceof Laya.Input) || evt.ctrlKey || evt.metaKey || evt.altKey || evt.shiftKey)
                return;
            let index = -1;
            switch (evt.key) {
                case "ArrowLeft":
                    index = this.handleArrowKey(7, evt);
                    break;
                case "ArrowRight":
                    index = this.handleArrowKey(3, evt);
                    break;
                case "ArrowUp":
                    index = this.handleArrowKey(1, evt);
                    break;
                case "ArrowDown":
                    index = this.handleArrowKey(5, evt);
                    break;
            }
            if (index != -1)
                evt.stopPropagation();
        }
        handleArrowKey(dir, evt) {
            var _a;
            let curIndex = this.index;
            if (curIndex == -1) {
                if (this._owner.numChildren > 0) {
                    this.clear();
                    this.add(0, true);
                    if (this._keyEvent)
                        this._owner.event(this._keyEvent, [this._owner.getChildAt(0), evt]);
                    return 0;
                }
                else
                    return -1;
            }
            let index = curIndex;
            let layout = (_a = this._owner.layout) === null || _a === void 0 ? void 0 : _a.type;
            if (layout == null)
                layout = exports.LayoutType.FlowX;
            switch (dir) {
                case 1:
                    if (layout == exports.LayoutType.SingleColumn || layout == exports.LayoutType.FlowY) {
                        index--;
                    }
                    else if (layout == exports.LayoutType.FlowX) {
                        let current = this._owner.getChildAt(index);
                        let k = 0;
                        let i;
                        for (i = index - 1; i >= 0; i--) {
                            let obj = this._owner.getChildAt(i);
                            if (obj.y != current.y) {
                                current = obj;
                                break;
                            }
                            k++;
                        }
                        for (; i >= 0; i--) {
                            let obj = this._owner.getChildAt(i);
                            if (obj.y != current.y) {
                                index = i + k + 1;
                                break;
                            }
                        }
                    }
                    break;
                case 3:
                    if (layout == exports.LayoutType.SingleRow || layout == exports.LayoutType.FlowX) {
                        index++;
                    }
                    else if (layout == exports.LayoutType.FlowY) {
                        let current = this._owner.getChildAt(index);
                        let k = 0;
                        let i;
                        let cnt = this._owner.numChildren;
                        for (i = index + 1; i < cnt; i++) {
                            let obj = this._owner.getChildAt(i);
                            if (obj.x != current.x) {
                                current = obj;
                                break;
                            }
                            k++;
                        }
                        for (; i < cnt; i++) {
                            let obj = this._owner.getChildAt(i);
                            if (obj.x != current.x) {
                                index = i - k - 1;
                                break;
                            }
                        }
                    }
                    break;
                case 5:
                    if (layout == exports.LayoutType.SingleColumn || layout == exports.LayoutType.FlowY) {
                        index++;
                    }
                    else if (layout == exports.LayoutType.FlowX) {
                        let current = this._owner.getChildAt(index);
                        let k = 0;
                        let i;
                        let cnt = this._owner.numChildren;
                        for (i = index + 1; i < cnt; i++) {
                            let obj = this._owner.getChildAt(i);
                            if (obj.y != current.y) {
                                current = obj;
                                break;
                            }
                            k++;
                        }
                        for (; i < cnt; i++) {
                            let obj = this._owner.getChildAt(i);
                            if (obj.y != current.y) {
                                index = i - k - 1;
                                break;
                            }
                        }
                    }
                    break;
                case 7:
                    if (layout == exports.LayoutType.SingleRow || layout == exports.LayoutType.FlowX) {
                        index--;
                    }
                    else if (layout == exports.LayoutType.FlowY) {
                        let current = this._owner.getChildAt(index);
                        let k = 0;
                        let i;
                        for (i = index - 1; i >= 0; i--) {
                            let obj = this._owner.getChildAt(i);
                            if (obj.x != current.x) {
                                current = obj;
                                break;
                            }
                            k++;
                        }
                        for (; i >= 0; i--) {
                            let obj = this._owner.getChildAt(i);
                            if (obj.x != current.x) {
                                index = i + k + 1;
                                break;
                            }
                        }
                    }
                    break;
            }
            if (index != curIndex && index >= 0 && index < this._owner.numChildren) {
                this.clear();
                this.add(index, true);
                if (this._keyEvent) {
                    this._owner.event(this._keyEvent, [this._owner.getChildAt(index), evt]);
                }
                return index;
            }
            else
                return -1;
        }
        selectChanged() {
            if (this._controller)
                this.index = this._controller.selectedIndex;
        }
        syncController(index) {
            let cc = this._controller;
            if (cc) {
                this._controller = null;
                cc.selectedIndex = index;
                this._controller = cc;
            }
        }
        _refresh() {
            if (this._mode === exports.SelectionMode.None)
                return;
            if (this._controller)
                this.index = this._controller.selectedIndex;
            else
                this.index = this._lastIndex;
        }
        destroy() {
            if (this._controller)
                this._controller.release();
        }
    }

    class ListSelection extends Selection {
        constructor(owner) {
            super(owner);
            this._layout = owner.layout;
        }
        get index() {
            if (this._layout._virtual) {
                for (let i = 0; i < this._layout._realNumItems; i++) {
                    let ii = this._layout._items[i];
                    if ((ii.obj instanceof GButton) && ii.obj.selected || ii.obj == null && ii.selected) {
                        if (this._layout._loop)
                            return i % this._layout.numItems;
                        else
                            return i;
                    }
                }
                return -1;
            }
            else
                return super.index;
        }
        set index(value) {
            if (this._layout._virtual) {
                if (value >= 0 && value < this._layout.numItems) {
                    if (this._mode != exports.SelectionMode.Single)
                        this.clear();
                    this.add(value);
                }
                else
                    this.clear();
            }
            else
                super.index = value;
        }
        get(out) {
            if (this._layout._virtual) {
                if (!out)
                    out = [];
                for (let i = 0; i < this._layout._realNumItems; i++) {
                    let ii = this._layout._items[i];
                    if ((ii.obj instanceof GButton) && ii.obj.selected
                        || ii.obj == null && ii.selected) {
                        let j = i;
                        if (this._layout._loop) {
                            j = i % this._layout.numItems;
                            if (out.indexOf(j) != -1)
                                continue;
                        }
                        out.push(j);
                    }
                }
                return out;
            }
            else
                return super.get(out);
        }
        add(index, scrollItToView) {
            if (this._layout._virtual) {
                if (this._mode == exports.SelectionMode.Disabled)
                    return;
                this._layout._checkVirtualList();
                if (this._mode == exports.SelectionMode.Single)
                    this.clear();
                if (scrollItToView)
                    this._owner.scroller.scrollTo(index);
                this._lastIndex = index;
                let obj;
                let ii = this._layout._items[index];
                if (ii.obj)
                    obj = ii.obj;
                ii.selected = true;
                if ((obj instanceof GButton) && !obj.selected)
                    obj.selected = true;
            }
            else
                super.add(index, scrollItToView);
        }
        remove(index) {
            if (this._layout._virtual) {
                if (this._mode == exports.SelectionMode.Disabled)
                    return;
                let obj;
                let ii = this._layout._items[index];
                if (ii.obj)
                    obj = ii.obj;
                ii.selected = false;
                if (obj instanceof GButton)
                    obj.selected = false;
            }
            else
                super.remove(index);
        }
        clear() {
            if (this._layout._virtual) {
                for (let i = 0; i < this._layout._realNumItems; i++) {
                    let ii = this._layout._items[i];
                    if (ii.obj instanceof GButton)
                        ii.obj.selected = false;
                    ii.selected = false;
                }
            }
            else
                super.clear();
        }
        clearExcept(g) {
            if (this._layout._virtual) {
                for (let i = 0; i < this._layout._realNumItems; i++) {
                    let ii = this._layout._items[i];
                    if (ii.obj != g) {
                        if ((ii.obj instanceof GButton))
                            ii.obj.selected = false;
                        ii.selected = false;
                    }
                }
            }
            else
                super.clearExcept(g);
        }
        selectAll() {
            if (this._layout._virtual) {
                this._layout._checkVirtualList();
                for (let i = 0; i < this._layout._realNumItems; i++) {
                    let ii = this._layout._items[i];
                    if ((ii.obj instanceof GButton) && !ii.obj.selected) {
                        ii.obj.selected = true;
                    }
                    ii.selected = true;
                }
            }
            else
                super.selectAll();
        }
        selectReverse() {
            if (this._layout._virtual) {
                this._layout._checkVirtualList();
                for (let i = 0; i < this._layout._realNumItems; i++) {
                    let ii = this._layout._items[i];
                    if (ii.obj instanceof GButton) {
                        ii.obj.selected = !ii.obj.selected;
                    }
                    ii.selected = !ii.selected;
                }
            }
            else
                super.selectReverse();
        }
        handleClick(item, evt) {
            if (this._layout._virtual) {
                let scroller = this._owner.scroller;
                if (scroller === null || scroller === void 0 ? void 0 : scroller.isDragged)
                    return;
                if (evt.button === 2 && !this.allowSelectByRightClick)
                    return;
                if (item.mode == exports.ButtonMode.Common) {
                    this._owner.event(exports.UIEvent.ClickItem, [item, evt]);
                    return;
                }
                let dontChangeLastIndex = false;
                let index = this._layout.childIndexToItemIndex(this._owner.getChildIndex(item));
                if (this._mode == exports.SelectionMode.Disabled) ;
                else if (this._mode == exports.SelectionMode.Single) {
                    if (!item.selected) {
                        this.clearExcept(item);
                        item.selected = true;
                        item.event(Laya.Event.CHANGED);
                    }
                }
                else {
                    if (evt.shiftKey) {
                        if (!item.selected) {
                            if (this._lastIndex != -1) {
                                let min = Math.min(this._lastIndex, index);
                                let max = Math.max(this._lastIndex, index);
                                max = Math.min(max, this._layout.numItems - 1);
                                for (let i = min; i <= max; i++) {
                                    let ii = this._layout._items[i];
                                    if (ii.obj instanceof GButton) {
                                        ii.obj.selected = true;
                                        if (ii.obj == item)
                                            item.event(Laya.Event.CHANGED);
                                    }
                                    ii.selected = true;
                                }
                                dontChangeLastIndex = true;
                            }
                            else {
                                item.selected = true;
                                item.event(Laya.Event.CHANGED);
                            }
                        }
                    }
                    else if ((evt.ctrlKey || evt.metaKey) || this._mode == exports.SelectionMode.MultipleBySingleClick) {
                        item.selected = !item.selected;
                        item.event(Laya.Event.CHANGED);
                    }
                    else {
                        if (!item.selected) {
                            this.clearExcept(item);
                            item.selected = true;
                            item.event(Laya.Event.CHANGED);
                        }
                        else if (evt.button == 0)
                            this.clearExcept(item);
                    }
                }
                if (!dontChangeLastIndex)
                    this._lastIndex = index;
                if (evt.isDblClick && (evt.target instanceof Laya.Input))
                    return;
                this._owner.event(exports.UIEvent.ClickItem, [item, evt]);
            }
            else
                super.handleClick(item, evt);
        }
        handleArrowKey(dir, evt) {
            if (this._layout._virtual) {
                let curIndex = this.index;
                if (curIndex == -1) {
                    if (this._owner.numChildren > 0) {
                        this.clear();
                        this.add(0, true);
                        if (this._keyEvent)
                            this._owner.event(this._keyEvent, [this._owner.getChildAt(0), evt]);
                        return 0;
                    }
                    else
                        return -1;
                }
                let index = curIndex;
                let layout = this._layout.type;
                switch (dir) {
                    case 1:
                        if (layout == exports.LayoutType.SingleColumn || layout == exports.LayoutType.FlowY) {
                            index--;
                        }
                        else if (layout == exports.LayoutType.FlowX) {
                            index -= this._layout._lineItemCnt;
                        }
                        break;
                    case 3:
                        if (layout == exports.LayoutType.SingleRow || layout == exports.LayoutType.FlowX) {
                            index++;
                        }
                        else if (layout == exports.LayoutType.FlowY) {
                            index += this._layout._lineItemCnt;
                        }
                        break;
                    case 5:
                        if (layout == exports.LayoutType.SingleColumn || layout == exports.LayoutType.FlowY) {
                            index++;
                        }
                        else if (layout == exports.LayoutType.FlowX) {
                            index += this._layout._lineItemCnt;
                        }
                        break;
                    case 7:
                        if (layout == exports.LayoutType.SingleRow || layout == exports.LayoutType.FlowX) {
                            index--;
                        }
                        else if (layout == exports.LayoutType.FlowY) {
                            index -= this._layout._lineItemCnt;
                        }
                        break;
                }
                if (index != curIndex && index >= 0 && index < this._layout.numItems) {
                    this.clear();
                    this.add(index, true);
                    if (this._keyEvent) {
                        let childIndex = this._layout.itemIndexToChildIndex(index);
                        if (childIndex != -1)
                            this._owner.event(this._keyEvent, [this._owner.getChildAt(childIndex), evt]);
                    }
                    return index;
                }
                else
                    return -1;
            }
            else
                return super.handleArrowKey(dir, evt);
        }
    }

    class GPanel extends GBox {
        constructor(layoutClass, selectionClass) {
            super(layoutClass);
            this._maskContainer = new Laya.Sprite();
            this._maskContainer.mouseThrough = true;
            this._maskContainer.hideFlags |= Laya.HideFlags.HideAndDontSave;
            this.addChild(this._maskContainer);
            let container = new PanelContainer();
            container.mouseThrough = true;
            container.hideFlags |= Laya.HideFlags.HideAndDontSave;
            container._setBit(Laya.NodeFlags.LOCK_BY_EDITOR, true);
            this._maskContainer.addChild(container);
            this._setContainer(container);
            this._selection = new (selectionClass || Selection)(this);
            this.clipping = true;
        }
        get scroller() {
            return this._scroller;
        }
        set scroller(value) {
            if (this._scroller)
                this._scroller.owner = null;
            this._scroller = value;
            if (value)
                value.owner = this;
        }
        get selection() {
            return this._selection;
        }
        get selectedIndex() {
            return this._selection.index;
        }
        set selectedIndex(value) {
            this._selection.index = value;
        }
        get clipping() {
            return this._clipping;
        }
        set clipping(value) {
            if (this._clipping != value) {
                this._clipping = value;
                if (this._clipping) {
                    this.scrollRect = new Laya.Rectangle(0, 0, this.width, this.height);
                }
                else
                    this.scrollRect = null;
                if (this._scroller)
                    this._scroller._processClipping();
            }
        }
        get viewWidth() {
            return this._layout.viewWidth;
        }
        set viewWidth(value) {
            this._layout.viewWidth = value;
        }
        get viewHeight() {
            return this._layout.viewHeight;
        }
        set viewHeight(value) {
            this._layout.viewHeight = value;
        }
        get touchItem() {
            let obj = Laya.InputManager.touchTarget;
            if (!obj)
                return null;
            let p = obj.parent;
            while (p != null) {
                if (p == this) {
                    if (obj.parent == this)
                        return obj;
                    else
                        return null;
                }
                obj = p;
                p = p.parent;
            }
            return null;
        }
        _sizeChanged(changeByLayout) {
            if (this._scrollRect)
                this.scrollRect = this._scrollRect.setTo(0, 0, this.width, this.height);
            if (this._scroller)
                this._scroller._ownerSizeChanged();
            if (changeByLayout)
                this._layout.refresh();
        }
        _panelChildChanged(child) {
            this.setLayoutChangedFlag(exports.LayoutChangedReason.Hierarchy);
        }
        destroy() {
            if (this._scroller)
                this._scroller.destroy();
            if (this._selection)
                this._selection.destroy();
            super.destroy();
        }
    }
    class PanelContainer extends GWidget {
        _childChanged(child) {
            super._childChanged(child);
            this._parent._parent._panelChildChanged(child);
        }
    }

    class GList extends GPanel {
        constructor() {
            super(ListLayout, ListSelection);
            this._layout.type = exports.LayoutType.SingleColumn;
            this._selection.mode = exports.SelectionMode.Single;
            this._pool = new WidgetPool();
        }
        destroy() {
            this.itemTemplate = null;
            this._pool.clear();
            super.destroy();
        }
        get layout() {
            return this._layout;
        }
        get itemTemplate() {
            return this._pool.defaultRes;
        }
        set itemTemplate(value) {
            this._pool.defaultRes = value;
        }
        get itemPool() {
            return this._pool;
        }
        getFromPool(url) {
            let obj = this._pool.take(url);
            if (obj)
                obj.visible = true;
            return obj;
        }
        returnToPool(obj) {
            this._pool.recover(obj);
        }
        addItemFromPool(url) {
            let child = this.getFromPool(url);
            if (child instanceof GButton)
                child.selected = false;
            return this.addChild(child);
        }
        removeChildToPoolAt(index) {
            let child = this.removeChildAt(index);
            this.returnToPool(child);
        }
        removeChildToPool(child) {
            this.removeChild(child);
            this.returnToPool(child);
        }
        removeChildrenToPool(beginIndex, endIndex) {
            beginIndex = beginIndex || 0;
            if (endIndex == null)
                endIndex = -1;
            if (endIndex < 0 || endIndex >= this.children.length)
                endIndex = this.children.length - 1;
            for (let i = beginIndex; i <= endIndex; ++i)
                this.removeChildToPoolAt(beginIndex);
        }
        get numItems() {
            return this._layout.numItems;
        }
        set numItems(value) {
            this._layout.numItems = value;
        }
        resizeToFit(itemCount, minSize) {
            this._layout.resizeToFit(itemCount, minSize);
        }
        childIndexToItemIndex(index) {
            return this._layout.childIndexToItemIndex(index);
        }
        itemIndexToChildIndex(index) {
            return this._layout.itemIndexToChildIndex(index);
        }
        refreshVirtualList() {
            this._layout.refreshVirtualList();
        }
        setVirtual() {
            this._setVirtual(false);
        }
        setVirtualAndLoop() {
            this._setVirtual(true);
        }
        _setVirtual(loop) {
            if (!this._layout._virtual) {
                if (this.scroller == null)
                    throw new Error("Virtual list must be scrollable!");
                if (loop) {
                    if (this._layout.type == exports.LayoutType.FlowX || this._layout.type == exports.LayoutType.FlowY)
                        throw new Error("Loop list does not support flowX or flowY layout!");
                    this.scroller.bouncebackEffect = exports.ScrollBounceBackEffect.Off;
                }
            }
            this._layout._setVirtual(loop);
        }
        onAfterDeserialize() {
            super.onAfterDeserialize();
            if (Laya.SerializeUtil.hasProp("_initItemNum", "_itemData") && (Laya.LayaEnv.isPreview || !Laya.SerializeUtil._data._isDemo))
                this._buildInitItems();
        }
        _buildInitItems() {
            for (let i = this.children.length - 1; i >= 0; i--) {
                let child = this.getChildAt(i);
                if (child.hasHideFlag(Laya.HideFlags.DontSave))
                    child.destroy();
            }
            if (this.itemTemplate == null)
                return;
            let itemData = this._itemData;
            for (let i = 0; i < this._initItemNum; i++) {
                let m = (itemData && i < itemData.length) ? itemData[i] : null;
                if (m != null) {
                    let child = (m.res ? m.res.create() : this.getFromPool());
                    child.hideFlags |= (Laya.LayaEnv.isPlaying ? Laya.HideFlags.DontSave : Laya.HideFlags.HideAndDontSave);
                    child.text = m.title;
                    if (m.icon)
                        child.icon = m.icon;
                    if (child instanceof GButton) {
                        if (m.selectedTitle)
                            child.selectedTitle = m.selectedTitle;
                        if (m.selectedIcon)
                            child.selectedIcon = m.selectedIcon;
                        child.selected = false;
                    }
                    if (m.name != null)
                        child.name = m.name;
                    this.addChild(child);
                }
                else
                    this.addItemFromPool();
            }
            this.selection._refresh();
        }
    }

    class GMovieClip extends GWidget {
        constructor() {
            super();
            this._color = "#ffffff";
            this.comp = this.addComponent(Laya.FrameAnimation);
            this.comp.hideFlags |= Laya.HideFlags.HideAndDontSave;
            this.comp.stretchMode = Laya.AnimationStretchMode.ResizeToFit;
        }
        get src() {
            return this.comp.source;
        }
        set src(value) {
            this.comp.source = value;
        }
        get icon() {
            return this.src;
        }
        set icon(value) {
            this.src = value;
        }
        get autoSize() {
            return this.comp.stretchMode === Laya.AnimationStretchMode.ResizeToFit;
        }
        set autoSize(value) {
            this.comp.stretchMode = value ? Laya.AnimationStretchMode.ResizeToFit : Laya.AnimationStretchMode.Fill;
        }
        get color() {
            return this._color;
        }
        set color(value) {
            this._color = value;
            this.comp.color.parse(value);
            this.comp.color = this.comp.color;
        }
        get frame() {
            return this.comp.frame;
        }
        set frame(value) {
            this.comp.frame = value;
        }
        get rangeStart() {
            return this.comp.rangeStart;
        }
        set rangeStart(value) {
            this.comp.rangeStart = value;
        }
        get rangeEnd() {
            return this.comp.rangeEnd;
        }
        set rangeEnd(value) {
            this.comp.rangeEnd = value;
        }
        get isPlaying() {
            return this.comp.isPlaying;
        }
        get autoPlay() {
            return this.comp.autoPlay;
        }
        set autoPlay(value) {
            this.comp.autoPlay = value;
        }
        get loop() {
            return this.comp.loop;
        }
        set loop(value) {
            this.comp.loop = value;
        }
        get timeScale() {
            return this.comp.timeScale;
        }
        set timeScale(value) {
            this.comp.timeScale = value;
        }
        _sizeChanged(changeByLayout) {
            super._sizeChanged();
            if (!changeByLayout && !Laya.SerializeUtil.isDeserializing)
                this.autoSize = false;
        }
    }

    class GProgressBar extends GWidget {
        constructor() {
            super();
            this._min = 0;
            this._max = 0;
            this._value = 0;
            this._titleType = 0;
            this._reverse = false;
            this._barMaxWidthDelta = 0;
            this._barMaxHeightDelta = 0;
            this._barStartX = 0;
            this._barStartY = 0;
            this._value = 50;
            this._max = 100;
        }
        get titleType() {
            return this._titleType;
        }
        set titleType(value) {
            if (this._titleType != value) {
                this._titleType = value;
                this.update(null, true);
            }
        }
        get min() {
            return this._min;
        }
        set min(value) {
            if (this._min != value) {
                this._min = value;
                this.update(null, true);
            }
        }
        get max() {
            return this._max;
        }
        set max(value) {
            if (this._max != value) {
                this._max = value;
                this.update(null, true);
            }
        }
        get value() {
            return this._value;
        }
        set value(value) {
            if (this._value != value) {
                if (this._tween) {
                    this._tween.kill();
                    this._tween = null;
                }
                this._value = value;
                this.update(null, true);
            }
        }
        get hBar() {
            return this._hBar;
        }
        set hBar(value) {
            this._hBar = value;
            this._value = this._max;
            this._barStartX = 0;
            this.update(null, false);
        }
        get vBar() {
            return this._vBar;
        }
        set vBar(value) {
            this._vBar = value;
            this._value = this._max;
            this._barStartY = 0;
            this.update(null, false);
        }
        get titleWidget() {
            return this._titleWidget;
        }
        set titleWidget(value) {
            this._titleWidget = value;
            this.update(null, false);
        }
        get reverse() {
            return this._reverse;
        }
        set reverse(value) {
            this._reverse = value;
            this.update(null, false);
        }
        tweenValue(value, duration) {
            let oldValule;
            if (this._tween) {
                let tweener = this._tween.findTweener("progress");
                if (tweener)
                    oldValule = tweener.value.get(null);
                else
                    oldValule = this._value;
                tweener.kill();
            }
            else
                oldValule = this._value;
            this._value = value;
            return Laya.Tween.create(this).name("progress").go(null, oldValule, this._value).duration(duration).ease("linear")
                .onUpdate(tweener => this.update(tweener.value.get(null)));
        }
        update(newValue, delay) {
            if (this._getBit(Laya.NodeFlags.EDITING_ROOT_NODE)) {
                this.updateTitle(this._max, this._max, 1);
                return;
            }
            if (newValue == null && delay === true) {
                Laya.ILaya.timer.callLater(this, this.update);
                return;
            }
            if (newValue == null)
                newValue = this._value;
            let percent = Laya.MathUtil.clamp01((newValue - this._min) / (this._max - this._min));
            this.updateTitle(newValue, this._max, percent);
            let fullWidth = this.width - this._barMaxWidthDelta;
            let fullHeight = this.height - this._barMaxHeightDelta;
            if (!this._reverse) {
                if (this._hBar) {
                    if (!this.setFillAmount(this._hBar, percent))
                        this._hBar.width = Math.round(fullWidth * percent);
                }
                if (this._vBar) {
                    if (!this.setFillAmount(this._vBar, percent))
                        this._vBar.height = Math.round(fullHeight * percent);
                }
            }
            else {
                if (this._hBar) {
                    if (!this.setFillAmount(this._hBar, 1 - percent)) {
                        this._hBar.width = Math.round(fullWidth * percent);
                        this._hBar.x = this._barStartX + (fullWidth - this._hBar.width);
                    }
                }
                if (this._vBar) {
                    if (!this.setFillAmount(this._vBar, 1 - percent)) {
                        this._vBar.height = Math.round(fullHeight * percent);
                        this._vBar.y = this._barStartY + (fullHeight - this._vBar.height);
                    }
                }
            }
        }
        updateTitle(value, max, percent) {
            let obj = this._titleWidget;
            if (!obj)
                return;
            switch (this._titleType) {
                case exports.ProgressTitleType.Percent:
                    obj.text = Math.floor(percent * 100) + "%";
                    break;
                case exports.ProgressTitleType.ValueAndMax:
                    obj.text = Math.floor(value) + "/" + Math.floor(max);
                    break;
                case exports.ProgressTitleType.Value:
                    obj.text = "" + Math.floor(value);
                    break;
                case exports.ProgressTitleType.Max:
                    obj.text = "" + Math.floor(max);
                    break;
            }
        }
        setFillAmount(bar, amount) {
            let mesh = bar.mesh;
            if (mesh instanceof Laya.ProgressMesh) {
                mesh.amount = amount;
                bar.graphics.repaint();
                return true;
            }
            else
                return false;
        }
        _onConstruct(inPrefab) {
            if (this._hBar) {
                this._barMaxWidthDelta = this.width - this._hBar.width;
                this._barStartX = this._hBar.x;
            }
            if (this._vBar) {
                this._barMaxHeightDelta = this.height - this._vBar.height;
                this._barStartY = this._vBar.y;
            }
            Laya.ILaya.timer.runCallLater(this, this.update, true);
            super._onConstruct(inPrefab);
        }
        _sizeChanged() {
            super._sizeChanged();
            this.update(null, true);
        }
    }

    const MIN_GRIP_SIZE = 20;
    class GScrollBar extends GWidget {
        constructor() {
            super();
            this._scrollPerc = 0;
            this._fixedGripSize = false;
            this._dragOffset = new Laya.Point();
            this.on(Laya.Event.MOUSE_DOWN, this, this._barTouchBegin);
        }
        setOwner(target, vertical) {
            this._target = target;
            this._vertical = vertical;
        }
        setDisplayPerc(value) {
            if (this._vertical) {
                if (!this._fixedGripSize)
                    this._gripButton.height = Math.max(Math.floor(value * this._bar.height), Math.min(MIN_GRIP_SIZE, this._bar.height));
                this._gripButton.y = this._bar.y + (this._bar.height - this._gripButton.height) * this._scrollPerc;
            }
            else {
                if (!this._fixedGripSize)
                    this._gripButton.width = Math.max(Math.floor(value * this._bar.width), Math.min(MIN_GRIP_SIZE, this._bar.width));
                this._gripButton.x = this._bar.x + (this._bar.width - this._gripButton.width) * this._scrollPerc;
            }
            this._gripButton.visible = value != 0 && value != 1;
        }
        setScrollPerc(val) {
            this._scrollPerc = val;
            if (this._vertical)
                this._gripButton.y = this._bar.y + (this._bar.height - this._gripButton.height) * this._scrollPerc;
            else
                this._gripButton.x = this._bar.x + (this._bar.width - this._gripButton.width) * this._scrollPerc;
        }
        get minSize() {
            if (this._vertical)
                return (this._arrowButton1 ? this._arrowButton1.height : 0) + (this._arrowButton2 ? this._arrowButton2.height : 0);
            else
                return (this._arrowButton1 ? this._arrowButton1.width : 0) + (this._arrowButton2 ? this._arrowButton2.width : 0);
        }
        get gripDragging() {
            return this._gripDragging;
        }
        get fixedGripSize() {
            return this._fixedGripSize;
        }
        set fixedGripSize(value) {
            this._fixedGripSize = value;
        }
        _onConstruct(inPrefab) {
            if (this._gripButton) {
                this._gripButton.on(Laya.Event.MOUSE_DOWN, this, this._gripTouchBegin);
                this._gripButton.on(Laya.Event.MOUSE_DRAG, this, this._gripTouchMove);
                this._gripButton.on(Laya.Event.MOUSE_UP, this, this._gripTouchEnd);
            }
            if (this._arrowButton1)
                this._arrowButton1.on(Laya.Event.MOUSE_DOWN, this, this._arrowButton1Click);
            if (this._arrowButton2)
                this._arrowButton2.on(Laya.Event.MOUSE_DOWN, this, this._arrowButton2Click);
            super._onConstruct(inPrefab);
        }
        _gripTouchBegin(evt) {
            if (!this._bar || !this._target)
                return;
            evt.stopPropagation();
            this._gripDragging = true;
            this._target._updateScrollBarVisible();
            this.globalToLocal(this._dragOffset.copy(evt.touchPos));
            this._dragOffset.x -= this._gripButton.x;
            this._dragOffset.y -= this._gripButton.y;
        }
        _gripTouchMove(evt) {
            if (!this.displayedInStage || !this._target)
                return;
            let pt = this.globalToLocal(s_vec2$1.copy(evt.touchPos));
            if (this._vertical) {
                let curY = pt.y - this._dragOffset.y;
                let diff = this._bar.height - this._gripButton.height;
                if (diff == 0)
                    this._target.percY = 0;
                else
                    this._target.percY = (curY - this._bar.y) / diff;
            }
            else {
                let curX = pt.x - this._dragOffset.x;
                let diff = this._bar.width - this._gripButton.width;
                if (diff == 0)
                    this._target.percX = 0;
                else
                    this._target.percX = (curX - this._bar.x) / (this._bar.width - this._gripButton.width);
            }
        }
        _gripTouchEnd(evt) {
            if (!this._target)
                return;
            this._gripDragging = false;
            this._target._updateScrollBarVisible();
        }
        _arrowButton1Click(evt) {
            evt.stopPropagation();
            if (!this._target)
                return;
            if (this._vertical)
                this._target.scrollUp();
            else
                this._target.scrollLeft();
        }
        _arrowButton2Click(evt) {
            evt.stopPropagation();
            if (!this._target)
                return;
            if (this._vertical)
                this._target.scrollDown();
            else
                this._target.scrollRight();
        }
        _barTouchBegin(evt) {
            evt.stopPropagation();
            if (!this._target)
                return;
            let pt = this._gripButton.globalToLocal(s_vec2$1.copy(evt.touchPos));
            if (this._vertical) {
                if (pt.y < 0)
                    this._target.scrollUp(4);
                else
                    this._target.scrollDown(4);
            }
            else {
                if (pt.x < 0)
                    this._target.scrollLeft(4);
                else
                    this._target.scrollRight(4);
            }
        }
    }
    const s_vec2$1 = new Laya.Point();

    class GSlider extends GWidget {
        constructor() {
            super();
            this.changeOnClick = true;
            this.canDrag = true;
            this._min = 0;
            this._max = 0;
            this._value = 0;
            this._titleType = 0;
            this._reverse = false;
            this._wholeNumbers = false;
            this._barMaxWidthDelta = 0;
            this._barMaxHeightDelta = 0;
            this._clickPercent = 0;
            this._barStartX = 0;
            this._barStartY = 0;
            this._value = 50;
            this._max = 100;
            this._clickPos = new Laya.Point();
            this.on(Laya.Event.MOUSE_DOWN, this, this._barTouchBegin);
        }
        get titleType() {
            return this._titleType;
        }
        set titleType(value) {
            if (this._titleType != value) {
                this._titleType = value;
                this.update(true);
            }
        }
        get wholeNumbers() {
            return this._wholeNumbers;
        }
        set wholeNumbers(value) {
            if (this._wholeNumbers != value) {
                this._wholeNumbers = value;
                this.update(true);
            }
        }
        get min() {
            return this._min;
        }
        set min(value) {
            if (this._min != value) {
                this._min = value;
                this.update(true);
            }
        }
        get max() {
            return this._max;
        }
        set max(value) {
            if (this._max != value) {
                this._max = value;
                this.update(true);
            }
        }
        get value() {
            return this._value;
        }
        set value(value) {
            if (this._value != value) {
                this._value = value;
                this.update(true);
            }
        }
        get hBar() {
            return this._hBar;
        }
        set hBar(value) {
            this._hBar = value;
            this._value = this._max;
            this._barStartX = 0;
            this.update(false);
        }
        get vBar() {
            return this._vBar;
        }
        set vBar(value) {
            this._vBar = value;
            this._value = this._max;
            this._barStartY = 0;
            this.update(false);
        }
        get gripButton() {
            return this._gripButton;
        }
        set gripButton(value) {
            this.setupEvents(false);
            this._gripButton = value;
            this.setupEvents(true);
        }
        get titleWidget() {
            return this._titleWidget;
        }
        set titleWidget(value) {
            this._titleWidget = value;
            this.update(false);
        }
        get reverse() {
            return this._reverse;
        }
        set reverse(value) {
            this._reverse = value;
            this.update(false);
        }
        update(delay) {
            if (delay === true)
                Laya.ILaya.timer.callLater(this, this.update);
            else
                this.updateWithPercent((this._value - this._min) / (this._max - this._min), false);
        }
        updateWithPercent(percent, manual) {
            if (this._getBit(Laya.NodeFlags.EDITING_ROOT_NODE)) {
                this.updateTitle(this._max, this._max, 1);
                return;
            }
            percent = Laya.MathUtil.clamp01(percent);
            if (manual) {
                let newValue = Laya.MathUtil.clamp(this._min + (this._max - this._min) * percent, this._min, this._max);
                if (this._wholeNumbers) {
                    newValue = Math.round(newValue);
                    percent = Laya.MathUtil.clamp01((newValue - this._min) / (this._max - this._min));
                }
                if (newValue != this._value) {
                    this._value = newValue;
                    this.event(Laya.Event.CHANGED, Laya.Event.EMPTY);
                    if (!this.canDrag)
                        return;
                }
            }
            this.updateTitle(this._value, this._max, percent);
            let fullWidth = this.width - this._barMaxWidthDelta;
            let fullHeight = this.height - this._barMaxHeightDelta;
            if (!this._reverse) {
                if (this._hBar)
                    this._hBar.width = Math.round(fullWidth * percent);
                if (this._vBar)
                    this._vBar.height = Math.round(fullHeight * percent);
            }
            else {
                if (this._hBar) {
                    this._hBar.width = Math.round(fullWidth * percent);
                    this._hBar.x = this._barStartX + (fullWidth - this._hBar.width);
                }
                if (this._vBar) {
                    this._vBar.height = Math.round(fullHeight * percent);
                    this._vBar.y = this._barStartY + (fullHeight - this._vBar.height);
                }
            }
        }
        updateTitle(value, max, percent) {
            let obj = this._titleWidget;
            if (!obj)
                return;
            switch (this._titleType) {
                case exports.ProgressTitleType.Percent:
                    obj.text = Math.floor(percent * 100) + "%";
                    break;
                case exports.ProgressTitleType.ValueAndMax:
                    obj.text = Math.floor(value) + "/" + Math.floor(max);
                    break;
                case exports.ProgressTitleType.Value:
                    obj.text = "" + Math.floor(value);
                    break;
                case exports.ProgressTitleType.Max:
                    obj.text = "" + Math.floor(max);
                    break;
            }
        }
        _onConstruct(inPrefab) {
            if (this._hBar) {
                this._barMaxWidthDelta = this.width - this._hBar.width;
                this._barStartX = this._hBar.x;
            }
            if (this._vBar) {
                this._barMaxHeightDelta = this.height - this._vBar.height;
                this._barStartY = this._vBar.y;
            }
            this.setupEvents(true);
            Laya.ILaya.timer.runCallLater(this, this.update, true);
            super._onConstruct(inPrefab);
        }
        setupEvents(add) {
            if (!Laya.LayaEnv.isPlaying)
                return;
            if (this._gripButton) {
                if (add) {
                    this._gripButton.on(Laya.Event.MOUSE_DOWN, this, this._gripTouchBegin);
                    this._gripButton.on(Laya.Event.MOUSE_DRAG, this, this._gripTouchMove);
                }
                else {
                    this._gripButton.off(Laya.Event.MOUSE_DOWN, this, this._gripTouchBegin);
                    this._gripButton.off(Laya.Event.MOUSE_DRAG, this, this._gripTouchMove);
                }
            }
        }
        _sizeChanged() {
            super._sizeChanged();
            this.update(true);
        }
        _gripTouchBegin(evt) {
            if (evt.button != 0)
                return;
            this.canDrag = true;
            evt.stopPropagation();
            this.globalToLocal(this._clickPos.copy(evt.touchPos));
            this._clickPercent = Laya.MathUtil.clamp01((this._value - this._min) / (this._max - this._min));
        }
        _gripTouchMove(evt) {
            if (!this.canDrag)
                return;
            let pt = this.globalToLocal(s_vec2.copy(evt.touchPos));
            let deltaX = pt.x - this._clickPos.x;
            let deltaY = pt.y - this._clickPos.y;
            if (this._reverse) {
                deltaX = -deltaX;
                deltaY = -deltaY;
            }
            let percent;
            if (this._hBar)
                percent = this._clickPercent + deltaX / (this.width - this._barMaxWidthDelta);
            else
                percent = this._clickPercent + deltaY / (this.height - this._barMaxHeightDelta);
            this.updateWithPercent(percent, true);
        }
        _barTouchBegin(evt) {
            if (!this.changeOnClick)
                return;
            let pt = this._gripButton.globalToLocal(s_vec2.copy(evt.touchPos));
            let percent = Laya.MathUtil.clamp01((this._value - this._min) / (this._max - this._min));
            let delta = 0;
            if (this._hBar)
                delta = (pt.x - this._gripButton.width / 2) / (this.width - this._barMaxWidthDelta);
            if (this._vBar)
                delta = (pt.y - this._gripButton.height / 2) / (this.height - this._barMaxHeightDelta);
            if (this._reverse)
                percent -= delta;
            else
                percent += delta;
            this.updateWithPercent(percent, true);
        }
        onAfterDeserialize() {
            if (Laya.SerializeUtil.hasProp("_gripButton"))
                this.setupEvents(true);
        }
    }
    const s_vec2 = new Laya.Point();

    class GTreeNode {
        constructor(isFolder, resURL, addIndent) {
            this._expanded = false;
            this._level = 0;
            this._indentLevel = 0;
            this._addIndent = 0;
            this._isFolder = isFolder;
            if (resURL)
                this._resURL = resURL;
            if (addIndent)
                this._addIndent = addIndent;
            this._children = [];
        }
        get expanded() {
            return this._expanded;
        }
        set expanded(value) {
            this._setExpanded(value);
        }
        _setExpanded(value, byEvent) {
            if (this._expanded != value) {
                this._expanded = value;
                if (this._tree && this.isFolder) {
                    if (this._expanded)
                        this._tree._afterExpanded(this, byEvent);
                    else
                        this._tree._afterCollapsed(this, byEvent);
                }
                if (this._expandCtrler)
                    this._expandCtrler.selectedIndex = this.expanded ? 1 : 0;
            }
        }
        get isFolder() {
            return this._isFolder || this._children.length > 0;
        }
        set isFolder(value) {
            if (this._isFolder != value) {
                this._isFolder = value;
                if (this._leafController)
                    this._leafController.selectedIndex = this.isFolder ? 0 : 1;
            }
        }
        get addIndent() {
            return this._addIndent;
        }
        set addIndent(value) {
            this._addIndent = value;
        }
        get parent() {
            return this._parent;
        }
        get text() {
            if (this._cell)
                return this._cell.text;
            else
                return null;
        }
        set text(value) {
            if (this._cell)
                this._cell.text = value;
        }
        get icon() {
            if (this._cell)
                return this._cell.icon;
            else
                return null;
        }
        set icon(value) {
            if (this._cell)
                this._cell.icon = value;
        }
        get cell() {
            return this._cell;
        }
        set cell(value) {
            if (this._cell) {
                this._cell.treeNode = null;
                this._indentObj = null;
                this._leafController = null;
                if (this._expandCtrler)
                    this._expandCtrler.off(Laya.Event.CHANGED, this, this._expandedStateChanged);
                let btn = this._cell.findChild("expandButton");
                if (btn)
                    btn.off(Laya.Event.CLICK, this, this._clickExpandButton);
                this._cell.off(Laya.Event.MOUSE_DOWN, this, this._cellMouseDown);
            }
            this._cell = value;
            this._cellFromPool = false;
            if (this._cell) {
                this._cell.treeNode = this;
                this._indentObj = this._cell.findChild("indent");
                if (this._tree && this._indentObj)
                    this._indentObj.width = Math.max(this._indentLevel - 1, 0) * this._tree.indent;
                this._expandCtrler = this._cell.getController("expanded");
                if (this._expandCtrler) {
                    this._expandCtrler.on(Laya.Event.CHANGED, this, this._expandedStateChanged);
                    this._expandCtrler.selectedIndex = this.expanded ? 1 : 0;
                }
                let btn = this._cell.findChild("expandButton");
                if (btn)
                    btn.on(Laya.Event.CLICK, this, this._clickExpandButton);
                this._leafController = this._cell.getController("leaf");
                if (this._leafController)
                    this._leafController.selectedIndex = this.isFolder ? 0 : 1;
                this._cell.on(Laya.Event.MOUSE_DOWN, this, this._cellMouseDown);
            }
        }
        createCell(tree) {
            if (this._cell)
                return;
            let child = (this._tree || tree).itemPool.take(this._resURL ? this._resURL : "");
            if (!child)
                throw new Error("cannot create tree node object.");
            child.hideFlags |= Laya.HideFlags.HideAndDontSave;
            if (child instanceof GButton)
                child.selected = false;
            this.cell = child;
            this._cellFromPool = true;
        }
        get level() {
            return this._level;
        }
        addChild(child) {
            this.addChildAt(child, this._children.length);
            return child;
        }
        addChildAt(child, index) {
            if (!child)
                throw new Error("child is null");
            let numChildren = this._children.length;
            if (index >= 0 && index <= numChildren) {
                if (child._parent == this) {
                    this.setChildIndex(child, index);
                }
                else {
                    if (child._parent)
                        child._parent.removeChild(child);
                    if (index == numChildren)
                        this._children.push(child);
                    else
                        this._children.splice(index, 0, child);
                    if (this.isFolder && this._leafController)
                        this._leafController.selectedIndex = 0;
                    child._parent = this;
                    child._level = this._level + 1;
                    child._indentLevel = this._indentLevel + 1 + child._addIndent;
                    child._setTree(this._tree);
                    if (this._tree && this == this._tree.rootNode || this._cell && this._cell.parent && this._expanded)
                        this._tree._afterInserted(child);
                }
                return child;
            }
            else {
                throw new Error(`Invalid child index ${index}`);
            }
        }
        removeChild(child) {
            let childIndex = this._children.indexOf(child);
            if (childIndex != -1) {
                this.removeChildAt(childIndex);
            }
            return child;
        }
        removeChildAt(index) {
            if (index >= 0 && index < this.numChildren) {
                let child = this._children[index];
                this._children.splice(index, 1);
                if (!this.isFolder && this._leafController)
                    this._leafController.selectedIndex = 1;
                child._parent = null;
                if (this._tree) {
                    child._setTree(null);
                    this._tree._afterRemoved(child);
                }
                return child;
            }
            else {
                throw new Error(`Invalid child index ${index}`);
            }
        }
        removeChildren(beginIndex, endIndex) {
            beginIndex = beginIndex || 0;
            if (endIndex == null)
                endIndex = -1;
            if (endIndex < 0 || endIndex >= this.numChildren)
                endIndex = this.numChildren - 1;
            for (let i = beginIndex; i <= endIndex; ++i)
                this.removeChildAt(beginIndex);
        }
        getChildAt(index) {
            if (index >= 0 && index < this.numChildren)
                return this._children[index];
            else
                throw new Error(`Invalid child index ${index}`);
        }
        getChildIndex(child) {
            return this._children.indexOf(child);
        }
        getPrevSibling() {
            if (this._parent == null)
                return null;
            let i = this._parent._children.indexOf(this);
            if (i <= 0)
                return null;
            return this._parent._children[i - 1];
        }
        getNextSibling() {
            if (this._parent == null)
                return null;
            let i = this._parent._children.indexOf(this);
            if (i < 0 || i >= this._parent._children.length - 1)
                return null;
            return this._parent._children[i + 1];
        }
        getLastVisibleDecendant() {
            let ret = this.findLastVisibleChild(this);
            return ret === this ? null : ret;
        }
        findLastVisibleChild(parentNode) {
            var _a;
            for (let i = parentNode.children.length - 1; i >= 0; i--) {
                let node = parentNode.children[i];
                if (((_a = node.cell) === null || _a === void 0 ? void 0 : _a.parent) && node.cell.visible)
                    return this.findLastVisibleChild(node) || node;
                else if (node.children.length > 0 && node.expanded) {
                    let ret = this.findLastVisibleChild(node);
                    if (ret)
                        return ret;
                }
            }
            return null;
        }
        setChildIndex(child, index) {
            let oldIndex = this._children.indexOf(child);
            if (oldIndex == -1)
                throw new Error("Not a child of this container");
            let cnt = this._children.length;
            if (index < 0)
                index = 0;
            else if (index > cnt)
                index = cnt;
            if (oldIndex == index)
                return;
            this._children.splice(oldIndex, 1);
            this._children.splice(index, 0, child);
            if (this._tree && this == this._tree.rootNode || this._cell && this._cell.parent && this._expanded)
                this._tree._afterMoved(child);
        }
        swapChildren(child1, child2) {
            let index1 = this._children.indexOf(child1);
            let index2 = this._children.indexOf(child2);
            if (index1 == -1 || index2 == -1)
                throw new Error("Not a child of this container");
            this.swapChildrenAt(index1, index2);
        }
        swapChildrenAt(index1, index2) {
            let child1 = this._children[index1];
            let child2 = this._children[index2];
            this._children[index1] = child2;
            this._children[index2] = child1;
            if (this._tree && this == this._tree.rootNode || this._cell && this._cell.parent && this._expanded) {
                if (index1 < index2) {
                    this._tree._afterMoved(child2);
                    this._tree._afterMoved(child1);
                }
                else {
                    this._tree._afterMoved(child1);
                    this._tree._afterMoved(child2);
                }
            }
        }
        get numChildren() {
            return this._children.length;
        }
        get children() {
            return this._children;
        }
        expandToRoot() {
            let p = this;
            while (p) {
                p.expanded = true;
                p = p.parent;
            }
        }
        get tree() {
            return this._tree;
        }
        _setTree(value) {
            this._tree = value;
            if (this._tree && this._indentObj)
                this._indentObj.width = Math.max(this._indentLevel - 1, 0) * this._tree.indent;
            if (this._tree && this._tree.treeNodeWillExpand && this._expanded)
                this._tree.treeNodeWillExpand(this, true);
            let cnt = this._children.length;
            for (let i = 0; i < cnt; i++) {
                let node = this._children[i];
                node._level = this._level + 1;
                node._indentLevel = this._indentLevel + 1 + node._addIndent;
                node._setTree(value);
            }
        }
        _expandedStateChanged() {
            this._setExpanded(this._expandCtrler.selectedIndex == 1, true);
        }
        _cellMouseDown(evt) {
            if (this._tree && this.isFolder)
                this._tree.selection._expandedStatusInEvt = this._expanded;
        }
        _clickExpandButton(evt) {
            evt.stopPropagation();
        }
    }

    class TreeSelection extends Selection {
        constructor() {
            super(...arguments);
            this._clickToExpand = 0;
        }
        get clickToExpand() {
            return this._clickToExpand;
        }
        set clickToExpand(value) {
            this._clickToExpand = value;
        }
        getSelectedNode() {
            let i = this.index;
            if (i != -1)
                return this._owner.getChildAt(i).treeNode;
            else
                return null;
        }
        getSelectedNodes(out) {
            s_list.length = 0;
            this.get(s_list);
            let cnt = s_list.length;
            let ret = [];
            for (let i = 0; i < cnt; i++) {
                let node = this._owner.getChildAt(s_list[i]).treeNode;
                ret.push(node);
            }
            return ret;
        }
        selectNode(node, scrollItToView) {
            let parentNode = node.parent;
            while (parentNode && parentNode != this._owner.rootNode) {
                parentNode.expanded = true;
                parentNode = parentNode.parent;
            }
            if (!node.cell)
                return;
            this.add(this._owner.getChildIndex(node.cell), scrollItToView);
        }
        unselectNode(node) {
            if (!node.cell)
                return;
            this.remove(this._owner.getChildIndex(node.cell));
        }
        handleClick(item, evt) {
            let scroller = this._owner.scroller;
            if (scroller === null || scroller === void 0 ? void 0 : scroller.isDragged)
                return;
            if (evt.button == 2 && !this.allowSelectByRightClick)
                return;
            if (this._clickToExpand != 0) {
                let node = item.treeNode;
                if (node && node.isFolder && this._expandedStatusInEvt == node.expanded) {
                    if (this._clickToExpand == 2) {
                        if (evt.isDblClick)
                            node._setExpanded(!node.expanded, true);
                    }
                    else
                        node._setExpanded(!node.expanded, true);
                }
            }
            super.handleClick(item, evt);
        }
        handleArrowKey(dir, evt) {
            if (dir == 3 || dir == 7) {
                let i = this.index;
                if (i != -1) {
                    let node = this._owner.getChildAt(i).treeNode;
                    if (node.isFolder) {
                        node.expanded = dir == 3;
                        return i;
                    }
                }
            }
            return super.handleArrowKey(dir, evt);
        }
    }
    var s_list = [];

    class GTree extends GPanel {
        constructor() {
            super(null, TreeSelection);
            this.scrollToViewOnExpand = false;
            this.indent = 15;
            this.layout.type = exports.LayoutType.SingleColumn;
            this.selection.mode = exports.SelectionMode.Single;
            this._pool = new WidgetPool();
            this.rootNode = new GTreeNode(true);
            this.rootNode._setTree(this);
            this.rootNode.expanded = true;
        }
        get selection() {
            return this._selection;
        }
        get clickToExpand() {
            return this._selection.clickToExpand;
        }
        set clickToExpand(value) {
            this._selection.clickToExpand = value;
        }
        get itemTemplate() {
            return this._pool.defaultRes;
        }
        set itemTemplate(value) {
            this._pool.defaultRes = value;
        }
        get itemPool() {
            return this._pool;
        }
        expandAll(folderNode) {
            if (!folderNode)
                folderNode = this.rootNode;
            folderNode.expanded = true;
            let cnt = folderNode.numChildren;
            for (let i = 0; i < cnt; i++) {
                let node = folderNode.getChildAt(i);
                if (node.isFolder)
                    this.expandAll(node);
            }
        }
        collapseAll(folderNode) {
            if (!folderNode)
                folderNode = this.rootNode;
            if (folderNode != this.rootNode)
                folderNode.expanded = false;
            let cnt = folderNode.numChildren;
            for (let i = 0; i < cnt; i++) {
                let node = folderNode.getChildAt(i);
                if (node.isFolder)
                    this.collapseAll(node);
            }
        }
        createCell(node) {
            node.createCell();
            if (this.treeNodeRender)
                this.treeNodeRender(node, node.cell);
        }
        _afterInserted(node) {
            if (!node.cell)
                this.createCell(node);
            let index = this.getInsertIndexForNode(node);
            this.addChildAt(node.cell, index);
            if (this.treeNodeRender)
                this.treeNodeRender(node, node.cell);
            if (node.isFolder && node.expanded)
                this.checkChildren(node, index);
        }
        getInsertIndexForNode(node) {
            let prevNode = node.getPrevSibling();
            if (prevNode == null)
                prevNode = node.parent;
            let insertIndex = this.getChildIndex(prevNode.cell) + 1;
            let myLevel = node.level;
            let cnt = this.numChildren;
            for (let i = insertIndex; i < cnt; i++) {
                let testNode = this.getChildAt(i).treeNode;
                if (testNode && testNode.level <= myLevel)
                    break;
                insertIndex++;
            }
            return insertIndex;
        }
        _afterRemoved(node) {
            this.removeNode(node);
        }
        _afterExpanded(node, byEvent) {
            if (node == this.rootNode) {
                this.checkChildren(this.rootNode, 0);
                return;
            }
            if (this.treeNodeWillExpand)
                this.treeNodeWillExpand(node, true);
            if (node.onExpanded)
                node.onExpanded(true);
            if (node.cell == null)
                return;
            if (this.treeNodeRender)
                this.treeNodeRender(node, node.cell);
            if (node.cell.parent) {
                this.checkChildren(node, this.getChildIndex(node.cell));
                if (this.scrollToViewOnExpand && this.scroller != null) {
                    let scrollTo = node.getLastVisibleDecendant();
                    if (scrollTo == null && node.cell.visible)
                        scrollTo = node;
                    if (scrollTo)
                        this.scroller.scrollTo(scrollTo.cell, false, node.cell);
                }
            }
        }
        _afterCollapsed(node, byEvent) {
            if (node == this.rootNode) {
                this.checkChildren(this.rootNode, 0);
                return;
            }
            if (this.treeNodeWillExpand)
                this.treeNodeWillExpand(node, false);
            if (node.onExpanded)
                node.onExpanded(false);
            if (node.cell == null)
                return;
            if (this.treeNodeRender)
                this.treeNodeRender(node, node.cell);
            if (node.cell.parent)
                this.hideFolderNode(node);
        }
        _afterMoved(node) {
            let startIndex = this.getChildIndex(node.cell);
            let endIndex;
            if (node.isFolder)
                endIndex = this.getFolderEndIndex(startIndex, node.level);
            else
                endIndex = startIndex + 1;
            let insertIndex = this.getInsertIndexForNode(node);
            if (startIndex == insertIndex || startIndex == insertIndex - 1)
                return;
            let cnt = endIndex - startIndex;
            if (insertIndex < startIndex) {
                for (let i = 0; i < cnt; i++) {
                    let obj = this.getChildAt(startIndex + i);
                    this._setChildIndex(obj, startIndex + i, insertIndex + i);
                }
            }
            else {
                for (let i = 0; i < cnt; i++) {
                    let obj = this.getChildAt(startIndex);
                    this._setChildIndex(obj, startIndex, insertIndex - 1);
                }
            }
        }
        getFolderEndIndex(startIndex, level) {
            let cnt = this.numChildren;
            for (let i = startIndex + 1; i < cnt; i++) {
                let node = this.getChildAt(i).treeNode;
                if (node.level <= level)
                    return i;
            }
            return cnt;
        }
        checkChildren(folderNode, index) {
            let cnt = folderNode.numChildren;
            for (let i = 0; i < cnt; i++) {
                index++;
                let node = folderNode.getChildAt(i);
                if (node.cell == null)
                    this.createCell(node);
                if (!node.cell.parent)
                    this.addChildAt(node.cell, index);
                if (node.isFolder && node.expanded)
                    index = this.checkChildren(node, index);
            }
            return index;
        }
        hideFolderNode(folderNode) {
            let cnt = folderNode.numChildren;
            for (let i = 0; i < cnt; i++) {
                let node = folderNode.getChildAt(i);
                if (node.cell)
                    this.removeChild(node.cell);
                if (node.isFolder && node.expanded)
                    this.hideFolderNode(node);
            }
        }
        removeNode(node) {
            if (node.cell) {
                node.cell.removeSelf();
                if (node._cellFromPool) {
                    this._pool.recover(node.cell);
                    node.cell = null;
                }
            }
            if (node.isFolder) {
                let cnt = node.numChildren;
                for (let i = 0; i < cnt; i++) {
                    let node2 = node.getChildAt(i);
                    this.removeNode(node2);
                }
            }
        }
        onAfterDeserialize() {
            super.onAfterDeserialize();
            if (Laya.SerializeUtil.hasProp("_initItemNum", "_itemData") && (Laya.LayaEnv.isPreview || !Laya.SerializeUtil._data._isDemo))
                this._buildInitItems();
        }
        _buildInitItems() {
            var _a, _b;
            this.rootNode.removeChildren();
            if (this.itemTemplate == null)
                return;
            let itemData = this._itemData;
            let prevLevel = 0;
            let lastNode;
            for (let i = 0; i < this._initItemNum; i++) {
                let m = (itemData && i < itemData.length) ? itemData[i] : null;
                if (m != null) {
                    let level = m.level || 0;
                    let isFolder = (((_a = itemData[i + 1]) === null || _a === void 0 ? void 0 : _a.level) || 0) > level;
                    let node = new GTreeNode(isFolder, (_b = m.res) === null || _b === void 0 ? void 0 : _b.url);
                    node.expanded = true;
                    if (i == 0)
                        this.rootNode.addChild(node);
                    else {
                        if (level > prevLevel)
                            lastNode.addChild(node);
                        else if (level < prevLevel) {
                            for (let j = level; j <= prevLevel; j++)
                                lastNode = lastNode.parent;
                            lastNode.addChild(node);
                        }
                        else
                            lastNode.parent.addChild(node);
                    }
                    lastNode = node;
                    prevLevel = level;
                    let child = node.cell;
                    child.text = m.title;
                    if (m.icon)
                        child.icon = m.icon;
                    if (child instanceof GButton) {
                        if (m.selectedTitle)
                            child.selectedTitle = m.selectedTitle;
                        if (m.selectedIcon)
                            child.selectedIcon = m.selectedIcon;
                        child.selected = false;
                    }
                    if (m.name != null)
                        child.name = m.name;
                }
                else {
                    let node = new GTreeNode();
                    this.rootNode.addChild(node);
                    prevLevel = 0;
                    lastNode = node;
                }
            }
            this.selection._refresh();
        }
    }

    class GearTweenConfig {
        constructor() {
            this.enabled = true;
            this.easeType = "quadOut";
            this.duration = 300;
            this.delay = 0;
        }
    }

    var s_Point = new Laya.Point();
    var s_rect = new Laya.Rectangle();
    var s_rect2 = new Laya.Rectangle();
    var s_endPos = new Laya.Point();
    var s_oldChange = new Laya.Point();
    var s_gestureFlag = 0;
    const TWEEN_TIME_GO = 0.5;
    const TWEEN_TIME_DEFAULT = 0.3;
    const PULL_RATIO = 0.5;
    var draggingInst;
    class Scroller {
        constructor() {
            this._dir = 0;
            this._step = 0;
            this._decelerationRate = 0;
            this._barDisplay = 0;
            this._barDisplay2 = 0;
            this._touchEffect2 = 0;
            this._bouncebackEffect2 = 0;
            this._touchEffectButton = 0;
            this._xPos = 0;
            this._yPos = 0;
            this._aniFlag = 0;
            this._headerLockedSize = 0;
            this._footerLockedSize = 0;
            this._tweening = 0;
            this._loop = 0;
            this._barMargin = [0, 0, 0, 0];
            this._viewSize = new Laya.Point();
            this._contentSize = new Laya.Point();
            this._pageSize = new Laya.Point(1, 1);
            this._overlapSize = new Laya.Point();
            this._tweenTime = new Laya.Point();
            this._tweenStart = new Laya.Point();
            this._tweenDuration = new Laya.Point();
            this._tweenChange = new Laya.Point();
            this._slidingPoints = [];
            this._containerPos = new Laya.Point();
            this._beginTouchPos = new Laya.Point();
            this._cachedScrollRect = new Laya.Rectangle();
            this._step = UIConfig2.defaultScrollStep;
            this._decelerationRate = UIConfig2.defaultScrollDecelerationRate;
            this._barDisplay = UIConfig2.defaultScrollBarDisplay;
            this._touchEffect = UIConfig2.defaultScrollTouchEffect;
            this._bouncebackEffect = UIConfig2.defaultScrollBounceEffect;
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            if (this._owner == value)
                return;
            if (this._owner) {
                this._owner.offAllCaller(this);
                if (this._tweening !== 0)
                    Laya.ILaya.timer.clear(this, this.tweenUpdate);
                if (this._hScrollBar) {
                    this._hScrollBar.destroy();
                    this._hScrollBar = null;
                }
                if (this._vScrollBar) {
                    this._vScrollBar.destroy();
                    this._vScrollBar = null;
                }
                if (this._header) {
                    this._header.destroy();
                    this._header = null;
                }
                if (this._footer) {
                    this._footer.destroy();
                    this._footer = null;
                }
                this._container.pos(0, 0);
                this._owner.setLayoutChangedFlag();
            }
            this._owner = value;
            if (value) {
                this._layout = value.layout;
                this._container = value._$container;
                this._maskContainer = this._container.parent;
                this._container.pos(0, 0);
                if (!Laya.SerializeUtil.isDeserializing) {
                    value.clipping = true;
                    this._setDefaultDirection();
                }
                this.createHzScrollBar();
                this.createVtScrollBar();
                value.on(Laya.Event.MOUSE_DOWN, this, this._touchBegin);
                value.on(Laya.Event.MOUSE_WHEEL, this, this._mouseWheel);
                value.on(Laya.Event.ROLL_OVER, this, this._rollOver);
                value.on(Laya.Event.ROLL_OUT, this, this._rollOut);
                value.setLayoutChangedFlag();
                this._processClipping();
                this._ownerSizeChanged();
            }
        }
        destroy() {
            this.owner = null;
        }
        get hScrollBar() {
            return this._hScrollBar;
        }
        get vScrollBar() {
            return this._vScrollBar;
        }
        get header() {
            return this._header;
        }
        get footer() {
            return this._footer;
        }
        get hScrollBarRes() {
            return this._hScrollBarRes;
        }
        set hScrollBarRes(value) {
            this._hScrollBarRes = value;
            this.createHzScrollBar(true);
        }
        get vScrollBarRes() {
            return this._vScrollBarRes;
        }
        set vScrollBarRes(value) {
            this._vScrollBarRes = value;
            this.createVtScrollBar(true);
        }
        get headerRes() {
            return this._headerRes;
        }
        set headerRes(value) {
            this._headerRes = value;
            this.createHeader();
        }
        get footerRes() {
            return this._footerRes;
        }
        set footerRes(value) {
            this._footerRes = value;
            this.createFooter();
        }
        get direction() {
            return this._dir;
        }
        set direction(value) {
            if (this._dir !== value) {
                this._dir = value;
                if (this._refreshBarAxis != null)
                    this._refreshBarAxis = (this._dir === exports.ScrollDirection.Both || this._dir === exports.ScrollDirection.Vertical) ? "y" : "x";
                this.createHzScrollBar();
                this.createVtScrollBar();
            }
        }
        get barDisplay() {
            return this._barDisplay2;
        }
        set barDisplay(value) {
            if (this._barDisplay2 !== value) {
                this._barDisplay2 = value;
                this._barDisplay = value === exports.ScrollBarDisplay.Default ? UIConfig2.defaultScrollBarDisplay : value;
                this.createHzScrollBar();
                this.createVtScrollBar();
            }
        }
        get barOnLeft() {
            return this._barOnLeft;
        }
        set barOnLeft(value) {
            if (this._barOnLeft != value) {
                this._barOnLeft = value;
                this.onSizeChanged();
            }
        }
        get barFloating() {
            return this._barFloating;
        }
        set barFloating(value) {
            if (this._barFloating != value) {
                this._barFloating = value;
                this.onSizeChanged();
            }
        }
        get barMargin() {
            return this._barMargin;
        }
        set barMargin(value) {
            if (value == null || !Array.isArray(value))
                value = [0, 0, 0, 0];
            this._barMargin = value;
            this.onSizeChanged();
        }
        get bouncebackEffect() {
            return this._bouncebackEffect2;
        }
        set bouncebackEffect(value) {
            this._bouncebackEffect2 = value;
            if (value === exports.ScrollBounceBackEffect.Default)
                this._bouncebackEffect = UIConfig2.defaultScrollBounceEffect;
            else
                this._bouncebackEffect = value == exports.ScrollBounceBackEffect.On;
        }
        get touchEffect() {
            return this._touchEffect2;
        }
        set touchEffect(value) {
            this._touchEffect2 = value;
            if (value === exports.ScrollTouchEffect.Default)
                this._touchEffect = UIConfig2.defaultScrollTouchEffect;
            else
                this._touchEffect = value === exports.ScrollTouchEffect.On;
        }
        get touchEffectButton() {
            return this._touchEffectButton;
        }
        set touchEffectButton(value) {
            this._touchEffectButton = value;
        }
        get pageMode() {
            return this._pageMode;
        }
        set pageMode(value) {
            this._pageMode = value;
        }
        set step(value) {
            this._step = value;
        }
        get step() {
            return this._step;
        }
        get snapToItem() {
            return this._snapToItem;
        }
        set snapToItem(value) {
            this._snapToItem = value;
        }
        get inertiaDisabled() {
            return this._inertiaDisabled;
        }
        set inertiaDisabled(value) {
            this._inertiaDisabled = value;
        }
        get paddingMaskDisabled() {
            return this._paddingMaskDisabled;
        }
        set paddingMaskDisabled(value) {
            if (this._paddingMaskDisabled != value) {
                this._paddingMaskDisabled = value;
                this._processClipping();
            }
        }
        get mouseWheelDisabled() {
            return this._mouseWheelDisabled;
        }
        set mouseWheelDisabled(value) {
            this._mouseWheelDisabled = value;
        }
        get decelerationRate() {
            return this._decelerationRate;
        }
        set decelerationRate(value) {
            this._decelerationRate = value;
        }
        get isDragged() {
            return this._dragged;
        }
        get percX() {
            return this._overlapSize.x === 0 ? 0 : this._xPos / this._overlapSize.x;
        }
        set percX(value) {
            this.setPercX(value, false);
        }
        setPercX(value, ani) {
            this._layout.refresh();
            this.setPosX(this._overlapSize.x * Laya.MathUtil.clamp01(value), ani);
        }
        get percY() {
            return this._overlapSize.y === 0 ? 0 : this._yPos / this._overlapSize.y;
        }
        set percY(value) {
            this.setPercY(value, false);
        }
        setPercY(value, ani) {
            this._layout.refresh();
            this.setPosY(this._overlapSize.y * Laya.MathUtil.clamp01(value), ani);
        }
        get posX() {
            return this._xPos;
        }
        set posX(value) {
            this.setPosX(value, false);
        }
        setPosX(value, ani) {
            this._layout.refresh();
            if (this._loop === 1)
                value = this.loopCheckingNewPos(value, "x");
            value = Laya.MathUtil.clamp(value, 0, this._overlapSize.x);
            if (value !== this._xPos) {
                this._xPos = value;
                this.posChanged(ani);
            }
        }
        get posY() {
            return this._yPos;
        }
        set posY(value) {
            this.setPosY(value, false);
        }
        setPosY(value, ani) {
            this._layout.refresh();
            if (this._loop === 1)
                value = this.loopCheckingNewPos(value, "y");
            value = Laya.MathUtil.clamp(value, 0, this._overlapSize.y);
            if (value !== this._yPos) {
                this._yPos = value;
                this.posChanged(ani);
            }
        }
        get contentWidth() {
            return this._contentSize.x;
        }
        get contentHeight() {
            return this._contentSize.y;
        }
        get viewWidth() {
            return this._viewSize.x;
        }
        get viewHeight() {
            return this._viewSize.y;
        }
        setViewSize(width, height) {
            width = width + this._layout.padding[3] + this._layout.padding[1];
            if (this._vScrollBar && !this._barFloating)
                width += this._vScrollBar.width;
            height = height + this._layout.padding[0] + this._layout.padding[2];
            if (this._hScrollBar && !this._barFloating)
                height += this._hScrollBar.height;
            this._owner.size(width, height);
        }
        get pageX() {
            if (!this._pageMode)
                return 0;
            let page = Math.floor(this._xPos / this._pageSize.x);
            if (this._xPos - page * this._pageSize.x > this._pageSize.x * 0.5)
                page++;
            return page;
        }
        set pageX(value) {
            this.setPageX(value, false);
        }
        get pageY() {
            if (!this._pageMode)
                return 0;
            let page = Math.floor(this._yPos / this._pageSize.y);
            if (this._yPos - page * this._pageSize.y > this._pageSize.y * 0.5)
                page++;
            return page;
        }
        set pageY(value) {
            this.setPageY(value, false);
        }
        setPageX(value, ani) {
            if (!this._pageMode)
                return;
            this._layout.refresh();
            if (this._overlapSize.x > 0)
                this.setPosX(value * this._pageSize.x, ani);
        }
        setPageY(value, ani) {
            if (!this._pageMode)
                return;
            this._layout.refresh();
            if (this._overlapSize.y > 0)
                this.setPosY(value * this._pageSize.y, ani);
        }
        get pageCountX() {
            return Math.ceil(this._contentSize.x / this._viewSize.x);
        }
        get pageCountY() {
            return Math.ceil(this._contentSize.y / this._viewSize.y);
        }
        get isBottomMost() {
            return this._yPos === this._overlapSize.y || this._overlapSize.y === 0;
        }
        get isRightMost() {
            return this._xPos === this._overlapSize.x || this._overlapSize.x === 0;
        }
        get scrollingPosX() {
            return Laya.MathUtil.clamp(-this._container.x, 0, this._overlapSize.x);
        }
        get scrollingPosY() {
            return Laya.MathUtil.clamp(-this._container.y, 0, this._overlapSize.y);
        }
        scrollTop(ani) {
            this.setPercY(0, ani);
        }
        scrollBottom(ani) {
            this.setPercY(1, ani);
        }
        scrollUp(ratio, ani) {
            ratio = ratio || 1;
            if (this._pageMode)
                this.setPosY(this._yPos - this._pageSize.y * ratio, ani);
            else
                this.setPosY(this._yPos - this._step * ratio, ani);
        }
        scrollDown(ratio, ani) {
            ratio = ratio || 1;
            if (this._pageMode)
                this.setPosY(this._yPos + this._pageSize.y * ratio, ani);
            else
                this.setPosY(this._yPos + this._step * ratio, ani);
        }
        scrollLeft(ratio, ani) {
            ratio = ratio || 1;
            if (this._pageMode)
                this.setPosX(this._xPos - this._pageSize.x * ratio, ani);
            else
                this.setPosX(this._xPos - this._step * ratio, ani);
        }
        scrollRight(ratio, ani) {
            ratio = ratio || 1;
            if (this._pageMode)
                this.setPosX(this._xPos + this._pageSize.x * ratio, ani);
            else
                this.setPosX(this._xPos + this._step * ratio, ani);
        }
        getRect(target, rect) {
            if (target._parent != this._owner._$container)
                Laya.SpriteUtils.transformRect(target._parent, rect.setTo(target.x, target.y, target.width, target.height), this._owner._$container, rect);
            else
                rect.setTo(target.x, target.y, target.width, target.height);
            return rect;
        }
        scrollTo(target, ani, setFirst) {
            this._layout.refresh();
            if (this._needRefresh)
                this.refresh();
            let rect;
            if (typeof (target) === "number") {
                if ((this._layout instanceof ListLayout) && this._layout._virtual)
                    target = this._layout.getRectByItemIndex(target);
                else
                    target = this._owner.getChildAt(target);
            }
            if (target instanceof Laya.Rectangle)
                rect = target;
            else if (target.parent == null)
                return;
            else
                rect = this.getRect(target, s_rect);
            let setFirstX, setFirstY;
            if (setFirst instanceof GWidget) {
                if (setFirst != target && setFirst.parent != null) {
                    let rect2 = this.getRect(setFirst, s_rect2);
                    if (this._overlapSize.x > 0 && rect.right - rect2.x > this._viewSize.x) {
                        rect.x = rect2.x;
                        rect.width = rect2.width;
                        setFirstX = true;
                    }
                    if (this._overlapSize.y > 0 && rect.bottom - rect2.y > this._viewSize.y) {
                        rect.y = rect2.y;
                        rect.height = rect2.height;
                        setFirstY = true;
                    }
                }
                else
                    setFirstX = setFirstY = false;
            }
            else
                setFirstX = setFirstY = !!setFirst;
            if (this._overlapSize.y > 0) {
                let bottom = this._yPos + this._viewSize.y;
                if (setFirstX || rect.y <= this._yPos) {
                    if (!setFirstX && rect.y + rect.height >= bottom)
                        return;
                    if (this._pageMode)
                        this.setPosY(Math.floor(rect.y / this._pageSize.y) * this._pageSize.y, ani);
                    else
                        this.setPosY(rect.y, ani);
                }
                else if (rect.y + rect.height > bottom) {
                    if (this._pageMode)
                        this.setPosY(Math.floor(rect.y / this._pageSize.y) * this._pageSize.y, ani);
                    else if (rect.height <= this._viewSize.y / 2)
                        this.setPosY(rect.y + rect.height * 2 - this._viewSize.y, ani);
                    else
                        this.setPosY(rect.y + Math.min(rect.height - this._viewSize.y, 0), ani);
                }
            }
            if (this._overlapSize.x > 0) {
                let right = this._xPos + this._viewSize.x;
                if (setFirstY || rect.x <= this._xPos) {
                    if (!setFirstY && rect.x + rect.width >= right)
                        return;
                    if (this._pageMode)
                        this.setPosX(Math.floor(rect.x / this._pageSize.x) * this._pageSize.x, ani);
                    else
                        this.setPosX(rect.x, ani);
                }
                else if (rect.x + rect.width > right) {
                    if (this._pageMode)
                        this.setPosX(Math.floor(rect.x / this._pageSize.x) * this._pageSize.x, ani);
                    else if (rect.width <= this._viewSize.x / 2)
                        this.setPosX(rect.x + rect.width * 2 - this._viewSize.x, ani);
                    else
                        this.setPosX(rect.x + Math.min(rect.width - this._viewSize.x, 0), ani);
                }
            }
            if (!ani && this._needRefresh)
                this.refresh();
        }
        isChildInView(obj) {
            if (this._overlapSize.y > 0) {
                let dist = obj.top + this._container.y;
                if (dist < -obj.height || dist > this._viewSize.y)
                    return false;
            }
            if (this._overlapSize.x > 0) {
                let dist = obj.left + this._container.x;
                if (dist < -obj.width || dist > this._viewSize.x)
                    return false;
            }
            return true;
        }
        getFirstChildInView() {
            let i = 0;
            for (let child of this._owner.children) {
                if (child._nodeType === 2 && this.isChildInView(child))
                    return i;
                i++;
            }
            return -1;
        }
        cancelDragging() {
            Laya.ILaya.stage.off(Laya.Event.MOUSE_MOVE, this, this._touchMove);
            Laya.ILaya.stage.off(Laya.Event.MOUSE_UP, this, this._touchEnd);
            if (draggingInst == this)
                draggingInst = null;
            s_gestureFlag = 0;
            this._dragged = false;
        }
        _setDefaultDirection() {
            let layout = this._layout;
            if (layout.pageMode)
                return;
            if (layout.type === exports.LayoutType.SingleColumn || layout.type === exports.LayoutType.FlowX)
                this.direction = exports.ScrollDirection.Vertical;
            else if (layout.type === exports.LayoutType.SingleRow || layout.type === exports.LayoutType.FlowY)
                this.direction = exports.ScrollDirection.Horizontal;
        }
        createVtScrollBar(force) {
            if (!this._owner)
                return;
            if (force) {
                let inst = this._vScrollBar;
                this._vScrollBar = null;
                this.createVtScrollBar();
                if (inst && inst !== this._vScrollBar) {
                    inst.destroy();
                    this.onSizeChanged();
                }
                return;
            }
            if (this._barDisplay !== exports.ScrollBarDisplay.Hidden && (this._dir === exports.ScrollDirection.Both || this._dir === exports.ScrollDirection.Vertical)) {
                if (this._vScrollBar)
                    return;
                let res = this._vScrollBarRes ? this._vScrollBarRes : (UIConfig2.verticalScrollBar ? Laya.ILaya.loader.getRes(UIConfig2.verticalScrollBar) : null);
                if (res) {
                    this._vScrollBar = res.create();
                    if (!this._vScrollBar) {
                        console.warn("failed to create a vertical scrollbar");
                        return;
                    }
                    this._vScrollBar.hideFlags |= Laya.HideFlags.HideAndDontSave;
                    this._vScrollBar.setOwner(this, true);
                    this._vScrollBar.visible = this._barDisplay !== exports.ScrollBarDisplay.OnScroll;
                    this._owner._addChild(this._vScrollBar);
                    this.onSizeChanged();
                }
            }
            else if (this._vScrollBar) {
                this._vScrollBar.destroy();
                this._vScrollBar = null;
                this.onSizeChanged();
            }
        }
        createHzScrollBar(force) {
            if (!this._owner)
                return;
            if (force) {
                let inst = this._hScrollBar;
                this._hScrollBar = null;
                this.createHzScrollBar();
                if (inst && inst !== this._hScrollBar) {
                    inst.destroy();
                    this.onSizeChanged();
                }
            }
            if (this._barDisplay !== exports.ScrollBarDisplay.Hidden && (this._dir === exports.ScrollDirection.Both || this._dir === exports.ScrollDirection.Horizontal)) {
                if (this._hScrollBar)
                    return;
                let res = this._hScrollBarRes ? this._hScrollBarRes : (UIConfig2.horizontalScrollBar ? Laya.ILaya.loader.getRes(UIConfig2.horizontalScrollBar) : null);
                if (res) {
                    this._hScrollBar = res.create();
                    if (!this._hScrollBar) {
                        console.warn("failed to create a horizontal scrollbar");
                        return;
                    }
                    this._hScrollBar.hideFlags |= Laya.HideFlags.HideAndDontSave;
                    this._hScrollBar.setOwner(this, false);
                    this._hScrollBar.visible = this._barDisplay !== exports.ScrollBarDisplay.OnScroll;
                    this._owner._addChild(this._hScrollBar);
                    this.onSizeChanged();
                }
            }
            else if (this._hScrollBar) {
                this._hScrollBar.destroy();
                this._hScrollBar = null;
                this.onSizeChanged();
            }
        }
        createHeader() {
            if (this._header) {
                this._header.destroy();
                this._header = null;
            }
            if (this._headerRes) {
                this._header = this._headerRes.create();
                if (this._header)
                    this._header.hideFlags |= Laya.HideFlags.HideAndDontSave;
            }
            if (this._header || this._footer)
                this._refreshBarAxis = (this._dir === exports.ScrollDirection.Both || this._dir === exports.ScrollDirection.Vertical) ? "y" : "x";
            else
                this._refreshBarAxis = null;
        }
        createFooter() {
            if (this._footer) {
                this._footer.destroy();
                this._footer = null;
            }
            if (this._footerRes) {
                this._footer = this._footerRes.create();
                if (this._footer)
                    this._footer.hideFlags |= Laya.HideFlags.HideAndDontSave;
            }
            if (this._header || this._footer)
                this._refreshBarAxis = (this._dir === exports.ScrollDirection.Both || this._dir === exports.ScrollDirection.Vertical) ? "y" : "x";
            else
                this._refreshBarAxis = null;
        }
        lockHeader(size) {
            if (this._headerLockedSize === size)
                return;
            this._headerLockedSize = size;
            if (!this._refreshEventDispatching && this._container[this._refreshBarAxis] >= 0) {
                this._tweenStart.setTo(this._container.x, this._container.y);
                this._tweenChange.setTo(0, 0);
                this._tweenChange[this._refreshBarAxis] = this._headerLockedSize - this._tweenStart[this._refreshBarAxis];
                this._tweenDuration.setTo(TWEEN_TIME_DEFAULT, TWEEN_TIME_DEFAULT);
                this.startTween(2);
            }
        }
        lockFooter(size) {
            if (this._footerLockedSize === size)
                return;
            this._footerLockedSize = size;
            if (!this._refreshEventDispatching && this._container[this._refreshBarAxis] <= -this._overlapSize[this._refreshBarAxis]) {
                this._tweenStart.setTo(this._container.x, this._container.y);
                this._tweenChange.setTo(0, 0);
                let max = this._overlapSize[this._refreshBarAxis];
                if (max === 0)
                    max = Math.max(this._contentSize[this._refreshBarAxis] + this._footerLockedSize - this._viewSize[this._refreshBarAxis], 0);
                else
                    max += this._footerLockedSize;
                this._tweenChange[this._refreshBarAxis] = -max - this._tweenStart[this._refreshBarAxis];
                this._tweenDuration.setTo(TWEEN_TIME_DEFAULT, TWEEN_TIME_DEFAULT);
                this.startTween(2);
            }
        }
        _shouldCheckOverflow() {
            if (this._barDisplay === exports.ScrollBarDisplay.OnOverflow || this._barDisplay === exports.ScrollBarDisplay.OnOverflowAndScroll)
                return (this._vScrollBar != null ? 1 : 0) + (this._hScrollBar != null ? 2 : 0);
            else
                return null;
        }
        _processClipping() {
            if (this._owner)
                this._maskContainer.scrollRect = (!this._paddingMaskDisabled && this._owner.clipping) ? this._cachedScrollRect : null;
        }
        _ownerSizeChanged() {
            this.onSizeChanged();
            this.posChanged(false);
        }
        onSizeChanged() {
            var _a, _b, _c;
            if (!this._owner)
                return;
            let aWidth = this._owner.width;
            let aHeight = this._owner.height;
            let padding = this._layout.padding;
            let mx, my;
            if (this._barOnLeft && this._vScrollBar && !this._barFloating)
                mx = Math.floor(padding[3] + this._vScrollBar.width);
            else
                mx = Math.floor(padding[3]);
            my = Math.floor(padding[0]);
            this._maskContainer.pos(mx, my);
            if (this._hScrollBar) {
                this._hScrollBar.pos(this._barMargin[3] + (this._barOnLeft ? (((_a = this._vScrollBar) === null || _a === void 0 ? void 0 : _a.width) || 0) : 0), aHeight - this._hScrollBar.height - this._barMargin[2]);
                this._hScrollBar.width = aWidth - (((_b = this._vScrollBar) === null || _b === void 0 ? void 0 : _b.width) || 0) - this._barMargin[3] - this._barMargin[1];
            }
            if (this._vScrollBar) {
                this._vScrollBar.pos(this._barOnLeft ? this._barMargin[3] : aWidth - this._vScrollBar.width - this._barMargin[1], this._barMargin[0]);
                this._vScrollBar.height = aHeight - (((_c = this._hScrollBar) === null || _c === void 0 ? void 0 : _c.height) || 0) - this._barMargin[0] - this._barMargin[2];
            }
            this._viewSize.x = aWidth;
            this._viewSize.y = aHeight;
            if (this._hScrollBar && !this._barFloating)
                this._viewSize.y -= this._hScrollBar.height;
            if (this._vScrollBar && !this._barFloating)
                this._viewSize.x -= this._vScrollBar.width;
            this._viewSize.x -= (padding[3] + padding[1]);
            this._viewSize.y -= (padding[0] + padding[2]);
            this._viewSize.x = Math.max(1, this._viewSize.x);
            this._viewSize.y = Math.max(1, this._viewSize.y);
            this._pageSize.x = this._viewSize.x;
            this._pageSize.y = this._viewSize.y;
            this.onContentSizeChanged();
        }
        _ownerContentSizeChanged() {
            let aWidth = this._layout.contentWidth;
            let aHeight = this._layout.contentHeight;
            if (this._contentSize.x === aWidth && this._contentSize.y === aHeight)
                return;
            this._contentSize.x = aWidth;
            this._contentSize.y = aHeight;
            this.onContentSizeChanged();
        }
        _changeContentSizeOnScrolling(deltaWidth, deltaHeight, deltaPosX, deltaPosY) {
            let isRightmost = this._xPos !== 0 && this._xPos === this._overlapSize.x;
            let isBottom = this._yPos !== 0 && this._yPos === this._overlapSize.y;
            this._contentSize.x += deltaWidth;
            this._contentSize.y += deltaHeight;
            this.onContentSizeChanged();
            if (this._tweening === 1) {
                if (deltaWidth !== 0 && isRightmost && this._tweenChange.x < 0) {
                    this._xPos = this._overlapSize.x;
                    this._tweenChange.x = -this._xPos - this._tweenStart.x;
                }
                if (deltaHeight !== 0 && isBottom && this._tweenChange.y < 0) {
                    this._yPos = this._overlapSize.y;
                    this._tweenChange.y = -this._yPos - this._tweenStart.y;
                }
            }
            else if (this._tweening === 2) {
                if (deltaPosX !== 0) {
                    this._container.x -= deltaPosX;
                    this._tweenStart.x -= deltaPosX;
                    this._xPos = -this._container.x;
                }
                if (deltaPosY !== 0) {
                    this._container.y -= deltaPosY;
                    this._tweenStart.y -= deltaPosY;
                    this._yPos = -this._container.y;
                }
            }
            else if (this._dragged) {
                if (deltaPosX !== 0) {
                    this._container.x -= deltaPosX;
                    this._containerPos.x -= deltaPosX;
                    this._xPos = -this._container.x;
                }
                if (deltaPosY !== 0) {
                    this._container.y -= deltaPosY;
                    this._containerPos.y -= deltaPosY;
                    this._yPos = -this._container.y;
                }
            }
            else {
                if (deltaWidth !== 0 && isRightmost) {
                    this._xPos = this._overlapSize.x;
                    this._container.x = -this._xPos;
                }
                if (deltaHeight !== 0 && isBottom) {
                    this._yPos = this._overlapSize.y;
                    this._container.y = -this._yPos;
                }
            }
        }
        onContentSizeChanged() {
            if (!this._owner)
                return;
            if (this._barDisplay === exports.ScrollBarDisplay.OnOverflow || this._barDisplay === exports.ScrollBarDisplay.OnOverflowAndScroll) {
                this._vScrollNone = this._contentSize.y <= this._viewSize.y;
                this._hScrollNone = this._contentSize.x <= this._viewSize.x;
                if (this._vScrollBar && this._hScrollBar) {
                    if (!this._hScrollNone)
                        this._vScrollBar.height = this._owner.height - this._hScrollBar.height - this._barMargin[0] - this._barMargin[2];
                    else
                        this._vScrollBar.height = this._owner.height - this._barMargin[0] - this._barMargin[2];
                    if (!this._vScrollNone)
                        this._hScrollBar.width = this._owner.width - this._vScrollBar.width - this._barMargin[3] - this._barMargin[1];
                    else
                        this._hScrollBar.width = this._owner.width - this._barMargin[3] - this._barMargin[1];
                }
            }
            if (this._vScrollBar) {
                if (this._contentSize.y === 0)
                    this._vScrollBar.setDisplayPerc(0);
                else
                    this._vScrollBar.setDisplayPerc(Math.min(1, this._viewSize.y / this._contentSize.y));
            }
            if (this._hScrollBar) {
                if (this._contentSize.x === 0)
                    this._hScrollBar.setDisplayPerc(0);
                else
                    this._hScrollBar.setDisplayPerc(Math.min(1, this._viewSize.x / this._contentSize.x));
            }
            this._updateScrollBarVisible();
            let mw = this._viewSize.x;
            let mh = this._viewSize.y;
            if (this._vScrollNone && this._vScrollBar != null)
                mw += this._vScrollBar.width;
            if (this._hScrollNone && this._hScrollBar != null)
                mh += this._hScrollBar.height;
            this._maskContainer.size(mw, mh);
            this._cachedScrollRect.setTo(0, 0, mw, mh);
            if (this._maskContainer._scrollRect != null)
                this._maskContainer.scrollRect = this._cachedScrollRect;
            if (this._dir === exports.ScrollDirection.Horizontal || this._dir === exports.ScrollDirection.Both)
                this._overlapSize.x = Math.ceil(Math.max(0, this._contentSize.x - this._viewSize.x));
            else
                this._overlapSize.x = 0;
            if (this._dir === exports.ScrollDirection.Vertical || this._dir === exports.ScrollDirection.Both)
                this._overlapSize.y = Math.ceil(Math.max(0, this._contentSize.y - this._viewSize.y));
            else
                this._overlapSize.y = 0;
            this._xPos = Laya.MathUtil.clamp(this._xPos, 0, this._overlapSize.x);
            this._yPos = Laya.MathUtil.clamp(this._yPos, 0, this._overlapSize.y);
            if (this._refreshBarAxis) {
                let max = this._overlapSize[this._refreshBarAxis];
                if (max === 0)
                    max = Math.max(this._contentSize[this._refreshBarAxis] + this._footerLockedSize - this._viewSize[this._refreshBarAxis], 0);
                else
                    max += this._footerLockedSize;
                if (this._refreshBarAxis == "x") {
                    this._container.pos(Laya.MathUtil.clamp(this._container.x, -max, this._headerLockedSize), Laya.MathUtil.clamp(this._container.y, -this._overlapSize.y, 0));
                }
                else {
                    this._container.pos(Laya.MathUtil.clamp(this._container.x, -this._overlapSize.x, 0), Laya.MathUtil.clamp(this._container.y, -max, this._headerLockedSize));
                }
                if (this._header) {
                    if (this._refreshBarAxis == "x")
                        this._header.height = this._viewSize.y;
                    else
                        this._header.width = this._viewSize.x;
                }
                if (this._footer) {
                    if (this._refreshBarAxis == "x")
                        this._footer.height = this._viewSize.y;
                    else
                        this._footer.width = this._viewSize.x;
                }
            }
            else {
                this._container.pos(Laya.MathUtil.clamp(this._container.x, -this._overlapSize.x, 0), Laya.MathUtil.clamp(this._container.y, -this._overlapSize.y, 0));
            }
            this.updateScrollBarPos();
        }
        posChanged(ani) {
            if (this._aniFlag === 0)
                this._aniFlag = ani ? 1 : -1;
            else if (this._aniFlag === 1 && !ani)
                this._aniFlag = -1;
            this._needRefresh = true;
            Laya.ILaya.timer.callLater(this, this.refresh);
        }
        refresh() {
            if (this._owner == null)
                return;
            this._needRefresh = false;
            Laya.ILaya.timer.clear(this, this.refresh);
            if (this._pageMode || this._snapToItem) {
                s_endPos.setTo(-this._xPos, -this._yPos);
                this.alignPosition(s_endPos, false);
                this._xPos = -s_endPos.x;
                this._yPos = -s_endPos.y;
            }
            this.refresh2();
            this._owner.event(exports.UIEvent.Scroll);
            if (this._needRefresh) {
                this._needRefresh = false;
                Laya.ILaya.timer.clear(this, this.refresh);
                this.refresh2();
            }
            this.updateScrollBarPos();
            this._aniFlag = 0;
        }
        refresh2() {
            if (this._aniFlag === 1 && !this._dragged) {
                let posX;
                let posY;
                if (this._overlapSize.x > 0)
                    posX = -Math.floor(this._xPos);
                else {
                    if (this._container.x !== 0)
                        this._container.x = 0;
                    posX = 0;
                }
                if (this._overlapSize.y > 0)
                    posY = -Math.floor(this._yPos);
                else {
                    if (this._container.y !== 0)
                        this._container.y = 0;
                    posY = 0;
                }
                if (posX !== this._container.x || posY !== this._container.y) {
                    this._tweenDuration.setTo(TWEEN_TIME_GO, TWEEN_TIME_GO);
                    this._tweenStart.setTo(this._container.x, this._container.y);
                    this._tweenChange.setTo(posX - this._tweenStart.x, posY - this._tweenStart.y);
                    this.startTween(1);
                }
                else if (this._tweening !== 0)
                    this.killTween();
            }
            else {
                if (this._tweening !== 0)
                    this.killTween();
                this._container.pos(Math.floor(-this._xPos), Math.floor(-this._yPos));
                this.loopCheckingCurrent();
            }
        }
        _touchBegin(evt) {
            if (!this._touchEffect || this._touchEffectButton !== evt.button)
                return;
            if (this._tweening !== 0) {
                this.killTween();
                Laya.InputManager.cancelClick(evt.touchId);
                this._dragged = true;
            }
            else
                this._dragged = false;
            let pt = this._owner.parent.globalToLocal(s_Point.copy(evt.touchPos));
            this._containerPos.setTo(this._container.x, this._container.y);
            this._beginTouchPos.setTo(pt.x, pt.y);
            this._isHoldAreaDone = false;
            this._slidingPoints.length = 0;
            this._slidingPoints.push(pt.x, pt.y, performance.now());
            Laya.ILaya.stage.on(Laya.Event.MOUSE_MOVE, this, this._touchMove);
            Laya.ILaya.stage.on(Laya.Event.MOUSE_UP, this, this._touchEnd);
        }
        _touchMove(evt) {
            var _a;
            if (!this._touchEffect || this.owner.destroyed)
                return;
            if (((_a = draggingInst === null || draggingInst === void 0 ? void 0 : draggingInst.owner) === null || _a === void 0 ? void 0 : _a.displayedInStage) && draggingInst != this)
                return;
            let sensitivity = UIConfig2.touchScrollSensitivity;
            let pt = this._owner.parent.globalToLocal(s_Point.copy(evt.touchPos));
            let offsetX = pt.x - this._slidingPoints[this._slidingPoints.length - 3];
            let offsetY = pt.y - this._slidingPoints[this._slidingPoints.length - 2];
            let diff;
            let sv, sh;
            if (this._dir === exports.ScrollDirection.Vertical) {
                if (!this._isHoldAreaDone) {
                    s_gestureFlag |= 1;
                    diff = Math.abs(offsetY);
                    if (diff < sensitivity)
                        return;
                    if ((s_gestureFlag & 2) !== 0) {
                        let diff2 = Math.abs(offsetX);
                        if (diff < diff2)
                            return;
                    }
                }
                sv = true;
            }
            else if (this._dir === exports.ScrollDirection.Horizontal) {
                if (!this._isHoldAreaDone) {
                    s_gestureFlag |= 2;
                    diff = Math.abs(offsetX);
                    if (diff < sensitivity)
                        return;
                    if ((s_gestureFlag & 1) !== 0) {
                        let diff2 = Math.abs(offsetY);
                        if (diff < diff2)
                            return;
                    }
                }
                sh = true;
            }
            else {
                s_gestureFlag = 3;
                if (!this._isHoldAreaDone) {
                    diff = Math.abs(offsetY);
                    if (diff < sensitivity) {
                        diff = Math.abs(offsetX);
                        if (diff < sensitivity)
                            return;
                    }
                }
                sv = sh = true;
            }
            let newPosX = Math.floor(this._containerPos.x + pt.x - this._beginTouchPos.x);
            let newPosY = Math.floor(this._containerPos.y + pt.y - this._beginTouchPos.y);
            if (sv) {
                if (newPosY > 0) {
                    if (!this._bouncebackEffect)
                        this._container.y = 0;
                    else
                        this._container.y = Math.floor(Math.min(newPosY * 0.5, this._viewSize.y * PULL_RATIO));
                }
                else if (newPosY < -this._overlapSize.y) {
                    if (!this._bouncebackEffect)
                        this._container.y = -this._overlapSize.y;
                    else
                        this._container.y = Math.floor(Math.max((newPosY + this._overlapSize.y) * 0.5, -this._viewSize.y * PULL_RATIO) - this._overlapSize.y);
                }
                else
                    this._container.y = newPosY;
            }
            if (sh) {
                if (newPosX > 0) {
                    if (!this._bouncebackEffect)
                        this._container.x = 0;
                    else
                        this._container.x = Math.floor(Math.min(newPosX * 0.5, this._viewSize.x * PULL_RATIO));
                }
                else if (newPosX < 0 - this._overlapSize.x) {
                    if (!this._bouncebackEffect)
                        this._container.x = -this._overlapSize.x;
                    else
                        this._container.x = Math.floor(Math.max((newPosX + this._overlapSize.x) * 0.5, -this._viewSize.x * PULL_RATIO) - this._overlapSize.x);
                }
                else
                    this._container.x = newPosX;
            }
            let now = performance.now();
            while (this._slidingPoints.length > 0 && this._slidingPoints[2] < now - 100)
                this._slidingPoints.splice(0, 3);
            this._slidingPoints.push(pt.x, pt.y, now);
            if (this._overlapSize.x > 0)
                this._xPos = Laya.MathUtil.clamp(-this._container.x, 0, this._overlapSize.x);
            if (this._overlapSize.y > 0)
                this._yPos = Laya.MathUtil.clamp(-this._container.y, 0, this._overlapSize.y);
            if (this._loop !== 0) {
                newPosX = this._container.x;
                newPosY = this._container.y;
                if (this.loopCheckingCurrent()) {
                    this._containerPos.x += this._container.x - newPosX;
                    this._containerPos.y += this._container.y - newPosY;
                }
            }
            draggingInst = this;
            this._isHoldAreaDone = true;
            this._dragged = true;
            this.updateScrollBarPos();
            this._updateScrollBarVisible();
            this._owner.event(exports.UIEvent.Scroll);
        }
        _touchEnd() {
            Laya.ILaya.stage.off(Laya.Event.MOUSE_MOVE, this, this._touchMove);
            Laya.ILaya.stage.off(Laya.Event.MOUSE_UP, this, this._touchEnd);
            if (draggingInst == this)
                draggingInst = null;
            s_gestureFlag = 0;
            if (!this._dragged || !this._touchEffect) {
                this._dragged = false;
                return;
            }
            this._dragged = false;
            this._tweenStart.setTo(this._container.x, this._container.y);
            s_endPos.setTo(this._tweenStart.x, this._tweenStart.y);
            let flag = false;
            if (this._container.x > 0) {
                s_endPos.x = 0;
                flag = true;
            }
            else if (this._container.x < -this._overlapSize.x) {
                s_endPos.x = -this._overlapSize.x;
                flag = true;
            }
            if (this._container.y > 0) {
                s_endPos.y = 0;
                flag = true;
            }
            else if (this._container.y < -this._overlapSize.y) {
                s_endPos.y = -this._overlapSize.y;
                flag = true;
            }
            if (flag) {
                this._tweenChange.setTo(s_endPos.x - this._tweenStart.x, s_endPos.y - this._tweenStart.y);
                if (this._tweenChange.x < -UIConfig2.touchDragSensitivity || this._tweenChange.y < -UIConfig2.touchDragSensitivity) {
                    this._refreshEventDispatching = true;
                    this._owner.event(exports.UIEvent.PullDownRelease);
                    this._refreshEventDispatching = false;
                }
                else if (this._tweenChange.x > UIConfig2.touchDragSensitivity || this._tweenChange.y > UIConfig2.touchDragSensitivity) {
                    this._refreshEventDispatching = true;
                    this._owner.event(exports.UIEvent.PullUpRelease);
                    this._refreshEventDispatching = false;
                }
                if (this._headerLockedSize > 0 && s_endPos[this._refreshBarAxis] === 0) {
                    s_endPos[this._refreshBarAxis] = this._headerLockedSize;
                    this._tweenChange.x = s_endPos.x - this._tweenStart.x;
                    this._tweenChange.y = s_endPos.y - this._tweenStart.y;
                }
                else if (this._footerLockedSize > 0 && s_endPos[this._refreshBarAxis] === -this._overlapSize[this._refreshBarAxis]) {
                    let max = this._overlapSize[this._refreshBarAxis];
                    if (max === 0)
                        max = Math.max(this._contentSize[this._refreshBarAxis] + this._footerLockedSize - this._viewSize[this._refreshBarAxis], 0);
                    else
                        max += this._footerLockedSize;
                    s_endPos[this._refreshBarAxis] = -max;
                    this._tweenChange.x = s_endPos.x - this._tweenStart.x;
                    this._tweenChange.y = s_endPos.y - this._tweenStart.y;
                }
                this._tweenDuration.setTo(TWEEN_TIME_DEFAULT, TWEEN_TIME_DEFAULT);
            }
            else {
                if (!this._inertiaDisabled) {
                    let velocity = Laya.DragSupport.computeVelocity(this._slidingPoints);
                    this.updateTargetAndDuration(this._tweenStart, velocity, "x", s_endPos, this._tweenDuration);
                    this.updateTargetAndDuration(this._tweenStart, velocity, "y", s_endPos, this._tweenDuration);
                }
                else
                    this._tweenDuration.setTo(TWEEN_TIME_DEFAULT, TWEEN_TIME_DEFAULT);
                s_oldChange.setTo(s_endPos.x - this._tweenStart.x, s_endPos.y - this._tweenStart.y);
                this.loopCheckingTarget(s_endPos);
                if (this._pageMode || this._snapToItem)
                    this.alignPosition(s_endPos, true);
                this._tweenChange.x = s_endPos.x - this._tweenStart.x;
                this._tweenChange.y = s_endPos.y - this._tweenStart.y;
                if (this._tweenChange.x === 0 && this._tweenChange.y === 0) {
                    this._updateScrollBarVisible();
                    return;
                }
                if (this._pageMode || this._snapToItem) {
                    this.fixDuration("x", s_oldChange.x);
                    this.fixDuration("y", s_oldChange.y);
                }
            }
            this.startTween(2);
        }
        _mouseWheel(evt) {
            if (this._mouseWheelDisabled)
                return;
            let delta = evt.delta;
            if (this._snapToItem && Math.abs(delta) < 1)
                delta = Math.sign(delta);
            if (this._overlapSize.x > 0 && this._overlapSize.y === 0) {
                let step = this._pageMode ? this._pageSize.x : this._step;
                this.setPosX(this._xPos + step * delta, false);
                evt.stopPropagation();
            }
            else {
                let step = this._pageMode ? this._pageSize.y : this._step;
                this.setPosY(this._yPos + step * delta, false);
                evt.stopPropagation();
            }
        }
        _rollOver() {
            this._hover = true;
            if (this._barDisplay === exports.ScrollBarDisplay.OnScroll || this._barDisplay === exports.ScrollBarDisplay.OnOverflowAndScroll)
                this._updateScrollBarVisible();
        }
        _rollOut() {
            this._hover = false;
            if (this._barDisplay === exports.ScrollBarDisplay.OnScroll || this._barDisplay === exports.ScrollBarDisplay.OnOverflowAndScroll)
                this._updateScrollBarVisible();
        }
        updateScrollBarPos() {
            if (this._vScrollBar)
                this._vScrollBar.setScrollPerc(this._overlapSize.y === 0 ? 0 : Laya.MathUtil.clamp(-this._container.y, 0, this._overlapSize.y) / this._overlapSize.y);
            if (this._hScrollBar)
                this._hScrollBar.setScrollPerc(this._overlapSize.x === 0 ? 0 : Laya.MathUtil.clamp(-this._container.x, 0, this._overlapSize.x) / this._overlapSize.x);
            this.checkRefreshBar();
        }
        _updateScrollBarVisible() {
            if (this._vScrollBar) {
                if (this._viewSize.y <= this._vScrollBar.minSize || this._vScrollNone)
                    this._vScrollBar.visible = false;
                else
                    this.updateScrollBarVisible2(this._vScrollBar);
            }
            if (this._hScrollBar) {
                if (this._viewSize.x <= this._hScrollBar.minSize || this._hScrollNone)
                    this._hScrollBar.visible = false;
                else
                    this.updateScrollBarVisible2(this._hScrollBar);
            }
        }
        updateScrollBarVisible2(bar) {
            let flag = this._barDisplay === exports.ScrollBarDisplay.OnScroll || this._barDisplay === exports.ScrollBarDisplay.OnOverflowAndScroll;
            if (flag)
                Laya.Tween.killAll(bar);
            if (flag && !this._hover && this._tweening === 0 && !this._dragged && !bar.gripDragging) {
                if (bar.visible)
                    Laya.Tween.create(bar).go("alpha", 1, 0).duration(0.5).delay(0.5).then(this._barTweenComplete, this);
            }
            else {
                bar.alpha = 1;
                bar.visible = true;
            }
        }
        _barTweenComplete(tweener) {
            let bar = tweener.target;
            bar.alpha = 1;
            bar.visible = false;
        }
        getLoopPartSize(division, axis) {
            return (this._contentSize[axis] + (axis == "x" ? this._owner.layout.columnGap : this._owner.layout.rowGap)) / division;
        }
        loopCheckingCurrent() {
            let changed = false;
            if (this._loop === 1 && this._overlapSize.x > 0) {
                if (this._xPos < 0.001) {
                    this._xPos += this.getLoopPartSize(2, "x");
                    changed = true;
                }
                else if (this._xPos >= this._overlapSize.x) {
                    this._xPos -= this.getLoopPartSize(2, "x");
                    changed = true;
                }
            }
            else if (this._loop === 2 && this._overlapSize.y > 0) {
                if (this._yPos < 0.001) {
                    this._yPos += this.getLoopPartSize(2, "y");
                    changed = true;
                }
                else if (this._yPos >= this._overlapSize.y) {
                    this._yPos -= this.getLoopPartSize(2, "y");
                    changed = true;
                }
            }
            if (changed)
                this._container.pos(Math.floor(-this._xPos), Math.floor(-this._yPos));
            return changed;
        }
        loopCheckingTarget(endPos) {
            if (this._loop === 1)
                this.loopCheckingTarget2(endPos, "x");
            if (this._loop === 2)
                this.loopCheckingTarget2(endPos, "y");
        }
        loopCheckingTarget2(endPos, axis) {
            let halfSize;
            let tmp;
            if (endPos[axis] > 0) {
                halfSize = this.getLoopPartSize(2, axis);
                tmp = this._tweenStart[axis] - halfSize;
                if (tmp <= 0 && tmp >= -this._overlapSize[axis]) {
                    endPos[axis] -= halfSize;
                    this._tweenStart[axis] = tmp;
                }
            }
            else if (endPos[axis] < -this._overlapSize[axis]) {
                halfSize = this.getLoopPartSize(2, axis);
                tmp = this._tweenStart[axis] + halfSize;
                if (tmp <= 0 && tmp >= -this._overlapSize[axis]) {
                    endPos[axis] += halfSize;
                    this._tweenStart[axis] = tmp;
                }
            }
        }
        loopCheckingNewPos(value, axis) {
            if (this._overlapSize[axis] === 0)
                return value;
            let pos = axis == "x" ? this._xPos : this._yPos;
            let changed = false;
            let v;
            if (value < 0.001) {
                value += this.getLoopPartSize(2, axis);
                if (value > pos) {
                    v = this.getLoopPartSize(6, axis);
                    v = Math.ceil((value - pos) / v) * v;
                    pos = Laya.MathUtil.clamp(pos + v, 0, this._overlapSize[axis]);
                    changed = true;
                }
            }
            else if (value >= this._overlapSize[axis]) {
                value -= this.getLoopPartSize(2, axis);
                if (value < pos) {
                    v = this.getLoopPartSize(6, axis);
                    v = Math.ceil((pos - value) / v) * v;
                    pos = Laya.MathUtil.clamp(pos - v, 0, this._overlapSize[axis]);
                    changed = true;
                }
            }
            if (changed) {
                if (axis == "x")
                    this._container.x = -Math.floor(pos);
                else
                    this._container.y = -Math.floor(pos);
            }
            return value;
        }
        alignPosition(pos, inertialScrolling) {
            if (this._pageMode) {
                pos.x = this.alignByPage(pos.x, "x", inertialScrolling);
                pos.y = this.alignByPage(pos.y, "y", inertialScrolling);
            }
            else if (this._snapToItem) {
                let xDir = 0;
                let yDir = 0;
                if (inertialScrolling) {
                    xDir = pos.x - this._containerPos.x;
                    yDir = pos.y - this._containerPos.y;
                }
                let pt = this._layout.getSnappingPosition(-pos.x, -pos.y, xDir, yDir, s_Point);
                if (pos.x < 0 && pos.x > -this._overlapSize.x)
                    pos.x = -pt.x;
                if (pos.y < 0 && pos.y > -this._overlapSize.y)
                    pos.y = -pt.y;
            }
        }
        alignByPage(pos, axis, inertialScrolling) {
            let page;
            if (pos > 0)
                page = 0;
            else if (pos < -this._overlapSize[axis])
                page = Math.ceil(this._contentSize[axis] / this._pageSize[axis]) - 1;
            else {
                page = Math.floor(-pos / this._pageSize[axis]);
                let change = inertialScrolling ? (pos - this._containerPos[axis]) : (pos - this._container[axis]);
                let testPageSize = Math.min(this._pageSize[axis], this._contentSize[axis] - (page + 1) * this._pageSize[axis]);
                let delta = -pos - page * this._pageSize[axis];
                if (Math.abs(change) > this._pageSize[axis]) {
                    if (delta > testPageSize * 0.5)
                        page++;
                }
                else {
                    if (delta > testPageSize * (change < 0 ? UIConfig2.defaultScrollPagingThreshold : (1 - UIConfig2.defaultScrollPagingThreshold)))
                        page++;
                }
                pos = -page * this._pageSize[axis];
                if (pos < -this._overlapSize[axis])
                    pos = -this._overlapSize[axis];
            }
            if (inertialScrolling) {
                let oldPos = this._tweenStart[axis];
                let oldPage;
                if (oldPos > 0)
                    oldPage = 0;
                else if (oldPos < -this._overlapSize[axis])
                    oldPage = Math.ceil(this._contentSize[axis] / this._pageSize[axis]) - 1;
                else
                    oldPage = Math.floor(-oldPos / this._pageSize[axis]);
                let startPage = Math.floor(-this._containerPos[axis] / this._pageSize[axis]);
                if (Math.abs(page - startPage) > 1 && Math.abs(oldPage - startPage) <= 1) {
                    if (page > startPage)
                        page = startPage + 1;
                    else
                        page = startPage - 1;
                    pos = -page * this._pageSize[axis];
                }
            }
            return pos;
        }
        updateTargetAndDuration(start, velocity, axis, outEnd, outDuration) {
            let pos = start[axis];
            let v = velocity[axis];
            if (pos > 0 || this._overlapSize[axis] === 0) {
                outEnd[axis] = 0;
                outDuration[axis] = TWEEN_TIME_DEFAULT;
            }
            else if (pos < -this._overlapSize[axis]) {
                outEnd[axis] = -this._overlapSize[axis];
                outDuration[axis] = TWEEN_TIME_DEFAULT;
            }
            else if (v !== 0) {
                let ratio = UIConfig2.defaultScrollDecelerationRate;
                let tmp = Math.log(ratio);
                let frames = -Math.log(Math.abs(v)) / tmp;
                let n = Math.pow(ratio, frames);
                tmp = ratio * (1 - n) / (1 - ratio);
                let change = v * tmp;
                if (Math.abs(change) <= 1) {
                    change = 0;
                    frames = 0;
                }
                outEnd[axis] = pos + change;
                outDuration[axis] = frames * 0.0166;
            }
            else {
                outEnd[axis] = pos;
                outDuration[axis] = 0;
            }
        }
        fixDuration(axis, oldChange) {
            if (this._tweenChange[axis] === 0 || Math.abs(this._tweenChange[axis]) >= Math.abs(oldChange)) {
                if (oldChange === 0)
                    this._tweenDuration[axis] = TWEEN_TIME_DEFAULT;
                return;
            }
            let newDuration = Math.abs(this._tweenChange[axis] / oldChange) * this._tweenDuration[axis];
            if (newDuration < TWEEN_TIME_DEFAULT)
                newDuration = TWEEN_TIME_DEFAULT;
            this._tweenDuration[axis] = newDuration;
        }
        startTween(type) {
            this._tweenTime.setTo(0, 0);
            this._tweening = type;
            Laya.ILaya.timer.frameLoop(1, this, this.tweenUpdate);
            this._updateScrollBarVisible();
        }
        killTween() {
            if (this._tweening === 1) {
                this._container.pos(this._tweenStart.x + this._tweenChange.x, this._tweenStart.y + this._tweenChange.y);
                this._owner.event(exports.UIEvent.Scroll);
            }
            this._tweening = 0;
            Laya.ILaya.timer.clear(this, this.tweenUpdate);
            this._updateScrollBarVisible();
            this._owner.event(exports.UIEvent.ScrollEnd);
        }
        checkRefreshBar() {
            if (this._header == null && this._footer == null)
                return;
            let pos = this._container[this._refreshBarAxis];
            if (this._header) {
                if (pos > 0) {
                    if (!this._header.parent) {
                        this._maskContainer.addChildAt(this._header, this._maskContainer.getChildIndex(this._container));
                    }
                    let pt = s_Point;
                    pt.setTo(this._header.width, this._header.height);
                    pt[this._refreshBarAxis] = pos;
                    this._header.size(pt.x, pt.y);
                }
                else {
                    this._header.removeSelf();
                }
            }
            if (this._footer) {
                let max = this._overlapSize[this._refreshBarAxis];
                if (pos < -max || max === 0 && this._footerLockedSize > 0) {
                    if (!this._footer.parent) {
                        this._maskContainer.addChildAt(this._footer, this._maskContainer.getChildIndex(this._container));
                    }
                    let pt = s_Point;
                    pt.setTo(this._footer.x, this._footer.y);
                    if (max > 0)
                        pt[this._refreshBarAxis] = pos + this._contentSize[this._refreshBarAxis];
                    else
                        pt[this._refreshBarAxis] = Math.max(Math.min(pos + this._viewSize[this._refreshBarAxis], this._viewSize[this._refreshBarAxis] - this._footerLockedSize), this._viewSize[this._refreshBarAxis] - this._contentSize[this._refreshBarAxis]);
                    this._footer.setLeftTop(pt.x, pt.y);
                    pt.setTo(this._footer.width, this._footer.height);
                    if (max > 0)
                        pt[this._refreshBarAxis] = -max - pos;
                    else
                        pt[this._refreshBarAxis] = this._viewSize[this._refreshBarAxis] - this._footer[this._refreshBarAxis];
                    this._footer.size(pt.x, pt.y);
                }
                else {
                    this._footer.removeSelf();
                }
            }
        }
        tweenUpdate() {
            let nx = this.runTween("x");
            let ny = this.runTween("y");
            this._container.pos(nx, ny);
            if (this._tweening === 2) {
                if (this._overlapSize.x > 0)
                    this._xPos = Laya.MathUtil.clamp(-nx, 0, this._overlapSize.x);
                if (this._overlapSize.y > 0)
                    this._yPos = Laya.MathUtil.clamp(-ny, 0, this._overlapSize.y);
            }
            if (this._tweenChange.x === 0 && this._tweenChange.y === 0) {
                this._tweening = 0;
                Laya.ILaya.timer.clear(this, this.tweenUpdate);
                this.loopCheckingCurrent();
                this.updateScrollBarPos();
                this._updateScrollBarVisible();
                this._owner.event(exports.UIEvent.Scroll);
                this._owner.event(exports.UIEvent.ScrollEnd);
            }
            else {
                this.updateScrollBarPos();
                this._owner.event(exports.UIEvent.Scroll);
            }
        }
        runTween(axis) {
            let newValue;
            if (this._tweenChange[axis] !== 0) {
                this._tweenTime[axis] += Laya.ILaya.timer.delta / 1000;
                if (this._tweenTime[axis] >= this._tweenDuration[axis]) {
                    newValue = this._tweenStart[axis] + this._tweenChange[axis];
                    this._tweenChange[axis] = 0;
                }
                else {
                    let ratio = easeFunc(this._tweenTime[axis], this._tweenDuration[axis]);
                    newValue = this._tweenStart[axis] + Math.floor(this._tweenChange[axis] * ratio);
                }
                let threshold1 = 0;
                let threshold2 = -this._overlapSize[axis];
                if (this._headerLockedSize > 0 && this._refreshBarAxis === axis)
                    threshold1 = this._headerLockedSize;
                if (this._footerLockedSize > 0 && this._refreshBarAxis === axis) {
                    let max = this._overlapSize[this._refreshBarAxis];
                    if (max === 0)
                        max = Math.max(this._contentSize[this._refreshBarAxis] + this._footerLockedSize - this._viewSize[this._refreshBarAxis], 0);
                    else
                        max += this._footerLockedSize;
                    threshold2 = -max;
                }
                if (this._tweening === 2 && this._bouncebackEffect) {
                    if (newValue > 20 + threshold1 && this._tweenChange[axis] > 0
                        || newValue > threshold1 && this._tweenChange[axis] === 0) {
                        this._tweenTime[axis] = 0;
                        this._tweenDuration[axis] = TWEEN_TIME_DEFAULT;
                        this._tweenChange[axis] = -newValue + threshold1;
                        this._tweenStart[axis] = newValue;
                    }
                    else if (newValue < threshold2 - 20 && this._tweenChange[axis] < 0
                        || newValue < threshold2 && this._tweenChange[axis] === 0) {
                        this._tweenTime[axis] = 0;
                        this._tweenDuration[axis] = TWEEN_TIME_DEFAULT;
                        this._tweenChange[axis] = threshold2 - newValue;
                        this._tweenStart[axis] = newValue;
                    }
                }
                else {
                    if (newValue > threshold1) {
                        newValue = threshold1;
                        this._tweenChange[axis] = 0;
                    }
                    else if (newValue < threshold2) {
                        newValue = threshold2;
                        this._tweenChange[axis] = 0;
                    }
                }
            }
            else
                newValue = this._container[axis];
            return newValue;
        }
    }
    function easeFunc(t, d) {
        return (t = t / d - 1) * t * t + 1;
    }

    class TranslationsLoader {
        load(task) {
            let url = task.url;
            return task.loader.fetch(url, "json", task.progress.createCallback(0.2), task.options).then(data => {
                if (!data)
                    return null;
                let files = data.files || {};
                let jsonFile = files[Translations.provider.language];
                if (!jsonFile && Translations.provider.language != data.defaultLanguage)
                    jsonFile = files[data.fallbackLanguage];
                let awaitor;
                if (jsonFile)
                    awaitor = task.loader.fetch(jsonFile, "json", task.progress.createCallback(0.8), task.options);
                else
                    awaitor = Promise.resolve({});
                return awaitor.then(content => {
                    let inst;
                    if (task.obsoluteInst && task.obsoluteInst.id == data.id)
                        inst = task.obsoluteInst;
                    else
                        inst = Translations.create(data.id);
                    inst.setContent(Translations.provider.language, content);
                    return inst;
                });
            });
        }
    }

    let r = Laya.ClassUtils.regClass;
    r("GWidget", GWidget);
    r("GImage", GImage);
    r("GMovieClip", GMovieClip);
    r("GLoader", GLoader);
    r("GTextField", GTextField);
    r("GTextInput", GTextInput);
    r("GBox", GBox);
    r("GPanel", GPanel);
    r("GLabel", GLabel);
    r("GButton", GButton);
    r("GComboBox", GComboBox);
    r("GList", GList);
    r("GProgressBar", GProgressBar);
    r("GScrollBar", GScrollBar);
    r("GSlider", GSlider);
    r("GTree", GTree);
    r("GWindow", GWindow);
    r("GRoot", GRoot);
    r("Controller", Controller);
    r("ControllerRef", ControllerRef);
    r("Relation", Relation);
    r("Gear", Gear);
    r("GearDisplay", GearDisplay);
    r("GearBool", GearBool);
    r("GearNumber", GearNumber);
    r("GearString", GearString);
    r("GearColor", GearColor);
    r("GearStrColor", GearStrColor);
    r("GearHexColor", GearHexColor);
    r("GearTweenConfig", GearTweenConfig);
    r("Selection", Selection);
    r("Scroller", Scroller);
    r("Layout", Layout);
    r("StretchParam", StretchParam);
    r("ItemData", class extends Object {
    });
    Laya.Loader.registerLoader(["i18ns"], TranslationsLoader);

    const internalEvent = "click_menu_item";
    class PopupMenu extends Laya.EventDispatcher {
        constructor(res, seperatorRes) {
            super();
            this.visibleItemCount = 0;
            this.hideOnClickItem = true;
            this.autoSize = false;
            if (!res)
                res = UIConfig2.popupMenu;
            let prefab = res ? Laya.Loader.getRes(res) : null;
            if (!res)
                throw new Error("UIConfig.popupMenu not defined");
            this._seperatorRes = seperatorRes || UIConfig2.popupMenuSeperator;
            this._content = prefab.create();
            this._initWidth = this._content.width;
            this._list = this._content.getChild("list");
            this._list.removeChildrenToPool();
            this._list.addRelation(this._content, exports.RelationType.Width);
            this._list.removeRelation(this._content, exports.RelationType.Height);
            this._content.addRelation(this._list, exports.RelationType.Height);
            this._list.on(exports.UIEvent.ClickItem, this, this._clickItem);
        }
        destroy() {
            this._content.destroy();
        }
        addItem(caption, callback, target) {
            let item = this.createItem(caption, callback, target);
            this._list.addChild(item);
            return item;
        }
        addItemAt(caption, index, callback, target) {
            let item = this.createItem(caption, callback, target);
            this._list.addChildAt(item, index);
            return item;
        }
        createItem(caption, callback, target) {
            let item = this._list.getFromPool();
            item.text = caption;
            item.grayed = false;
            let c = item.getController("checked");
            if (c)
                c.selectedIndex = 0;
            item.offAll(internalEvent);
            if (callback)
                item.on(internalEvent, target, callback, [item]);
            return item;
        }
        addSeperator(index) {
            if (index == undefined || index == -1)
                this._list.addItemFromPool(this._seperatorRes);
            else {
                let item = this._list.getFromPool(this._seperatorRes);
                this._list.addChildAt(item, index);
            }
        }
        getItemName(index) {
            let item = this._list.getChildAt(index);
            return item.name;
        }
        setItemText(name, caption) {
            let item = this._list.getChild(name);
            item.text = caption;
        }
        setItemVisible(name, visible) {
            let item = this._list.getChild(name);
            item.visible = visible;
        }
        setItemGrayed(name, grayed) {
            let item = this._list.getChild(name);
            item.grayed = grayed;
        }
        setItemCheckable(name, checkable) {
            let item = this._list.getChild(name);
            let c = item.getController("checked");
            if (c) {
                if (checkable) {
                    if (c.selectedIndex == 0)
                        c.selectedIndex = 1;
                }
                else
                    c.selectedIndex = 0;
            }
        }
        setItemChecked(name, checked) {
            let item = this._list.getChild(name);
            let c = item.getController("checked");
            if (c)
                c.selectedIndex = checked ? 2 : 1;
        }
        isItemChecked(name) {
            let item = this._list.getChild(name);
            let c = item.getController("checked");
            if (c)
                return c.selectedIndex == 2;
            else
                return false;
        }
        removeItem(name) {
            let item = this._list.getChild(name);
            if (item) {
                let index = this._list.getChildIndex(item);
                this._list.removeChildToPoolAt(index);
                return true;
            }
            else
                return false;
        }
        clearItems() {
            this._list.removeChildrenToPool();
        }
        get itemCount() {
            return this._list.numChildren;
        }
        get contentPane() {
            return this._content;
        }
        get list() {
            return this._list;
        }
        show(target, dir) {
            if (GRoot.inst.popupMgr.isPopupJustClosed(this._content))
                return;
            this.event(exports.UIEvent.Popup);
            if (this.autoSize) {
                this._list.layout.refresh();
                let cnt = this._list.numChildren;
                let maxDelta = -1000;
                for (let i = 0; i < cnt; i++) {
                    let obj = this._list.getChildAt(i);
                    if (!(obj instanceof GButton))
                        continue;
                    let tf = obj.findTextWidget();
                    if (tf instanceof GTextField) {
                        let v = tf.textWidth - tf.width;
                        if (v > maxDelta)
                            maxDelta = v;
                    }
                }
                if (this._content.width + maxDelta > this._initWidth)
                    this._content.width += maxDelta;
                else
                    this._content.width = this._initWidth;
            }
            this._list.selection.index = -1;
            this._list.resizeToFit(this.visibleItemCount > 0 ? this.visibleItemCount : Number.POSITIVE_INFINITY, 10);
            GRoot.inst.popupMgr.togglePopup(this._content, target, dir);
        }
        hide() {
            if (this._content.parent)
                GRoot.inst.popupMgr.hidePopup(this._content);
        }
        _clickItem(item) {
            if (!(item instanceof GButton))
                return;
            if (item.grayed) {
                this._list.selection.index = -1;
                return;
            }
            let c = item.getController("checked");
            if (c && c.selectedIndex != 0) {
                if (c.selectedIndex == 1)
                    c.selectedIndex = 2;
                else
                    c.selectedIndex = 1;
            }
            if (this.hideOnClickItem)
                this.hide();
            item.event(internalEvent, item);
        }
    }

    class UIPackage {
        static createButton() {
            return Laya.Loader.createNodes("internal/UI/Button.lh");
        }
        static createRadio() {
            return Laya.Loader.createNodes("internal/UI/Radio.lh");
        }
        static createCheckBox() {
            return Laya.Loader.createNodes("internal/UI/CheckBox.lh");
        }
        static createProgressBar() {
            return Laya.Loader.createNodes("internal/UI/ProgressBar.lh");
        }
        static createSliderH() {
            return Laya.Loader.createNodes("internal/UI/SliderH.lh");
        }
        static createSliderV() {
            return Laya.Loader.createNodes("internal/UI/SliderV.lh");
        }
        static createTextInput() {
            return Laya.Loader.createNodes("internal/UI/TextInput.lh");
        }
        static createTextArea() {
            return Laya.Loader.createNodes("internal/UI/TextArea.lh");
        }
        static createComboBox() {
            return Laya.Loader.createNodes("internal/UI/ComboBox.lh");
        }
        static _init() {
            if (!Laya.LayaEnv.isPlaying)
                return null;
            GRoot.inst;
            const urls = [
                UIConfig2.windowModalWaiting,
                UIConfig2.globalModalWaiting,
                UIConfig2.popupMenu,
                UIConfig2.tooltipsWidget,
                UIConfig2.horizontalScrollBar,
                UIConfig2.verticalScrollBar
            ].filter((url) => url != null);
            if (Laya.PlayerConfig.UI.alwaysIncludeDefaultSkin) {
                urls.push(...[
                    "Button.lh",
                    "Radio.lh",
                    "CheckBox.lh",
                    "ProgressBar.lh",
                    "SliderH.lh",
                    "SliderV.lh",
                    "TextInput.lh",
                    "TextArea.lh",
                    "ComboBox.lh"
                ].map((url) => "internal/UI/" + url));
            }
            return Laya.ILaya.loader.load(urls);
        }
    }
    Laya.Laya.addAfterInitCallback(UIPackage._init);

    exports.ButtonPageAlternatives = ButtonPageAlternatives;
    exports.Controller = Controller;
    exports.ControllerRef = ControllerRef;
    exports.DragDropManager = DragDropManager;
    exports.GBox = GBox;
    exports.GButton = GButton;
    exports.GComboBox = GComboBox;
    exports.GImage = GImage;
    exports.GLabel = GLabel;
    exports.GList = GList;
    exports.GLoader = GLoader;
    exports.GMovieClip = GMovieClip;
    exports.GPanel = GPanel;
    exports.GProgressBar = GProgressBar;
    exports.GRoot = GRoot;
    exports.GScrollBar = GScrollBar;
    exports.GSlider = GSlider;
    exports.GTextField = GTextField;
    exports.GTextInput = GTextInput;
    exports.GTree = GTree;
    exports.GTreeNode = GTreeNode;
    exports.GWidget = GWidget;
    exports.GWindow = GWindow;
    exports.Gear = Gear;
    exports.GearBool = GearBool;
    exports.GearColor = GearColor;
    exports.GearDisplay = GearDisplay;
    exports.GearHexColor = GearHexColor;
    exports.GearNumber = GearNumber;
    exports.GearStrColor = GearStrColor;
    exports.GearString = GearString;
    exports.GearTweenConfig = GearTweenConfig;
    exports.ImageRenderer = ImageRenderer;
    exports.Layout = Layout;
    exports.ListLayout = ListLayout;
    exports.ListSelection = ListSelection;
    exports.PopupManager = PopupManager;
    exports.PopupMenu = PopupMenu;
    exports.Relation = Relation;
    exports.Scroller = Scroller;
    exports.Selection = Selection;
    exports.StretchParam = StretchParam;
    exports.Translations = Translations;
    exports.TranslationsLoader = TranslationsLoader;
    exports.TreeSelection = TreeSelection;
    exports.UIConfig2 = UIConfig2;
    exports.UIPackage = UIPackage;
    exports.WidgetPool = WidgetPool;
    exports.WidgetRef = WidgetRef;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.ui2.js.map
