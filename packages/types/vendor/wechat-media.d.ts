/*! *****************************************************************************
Copyright (c) 2025 Tencent, Inc. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
***************************************************************************** */
// Media-only declarations from minigame-api-typings 3.8.21. Excludes host globals
// such as console/wx/require, which conflict with browser consumers.
declare namespace WechatMinigame {
interface InnerAudioContext {
        /** 是否自动开始播放，默认为 `false` */
        autoplay: boolean
        /** 音频缓冲的时间点，仅保证当前播放时间点到此时间点内容已缓冲（只读） */
        buffered: number
        /** 当前音频的播放位置（单位 s）。只有在当前有合法的 src 时返回，时间保留小数点后 6 位（currentTime 属性在基础库 2.26.2 之前只读，基础库 2.26.2 开始可读可写，改变 currentTime 值等同于调用 seek） */
        currentTime: number
        /** 当前音频的长度（单位 s）。只有在当前有合法的 src 时返回（只读） */
        duration: number
        /** 是否循环播放，默认为 `false` */
        loop: boolean
        /** 是否遵循系统静音开关，默认为 `true`。当此参数为 `false` 时，即使用户打开了静音开关，也能继续发出声音。从 2.3.0 版本开始此参数不生效，使用 [wx.setInnerAudioOption](https://developers.weixin.qq.com/minigame/dev/api/media/audio/wx.setInnerAudioOption.html) 接口统一设置。 */
        obeyMuteSwitch: boolean
        /** 当前是是否暂停或停止状态（只读） */
        paused: boolean
        /** 需要基础库： `2.11.0`
         *
         * 播放速度。范围 0.5-2.0，默认为 1。（Android 需要 6 及以上版本） */
        playbackRate: number
        /** 需要基础库： `2.13.0`
         *
         * `origin`: 发送完整的referrer; `no-referrer`: 不发送。格式固定为 `https://servicewechat.com/{appid}/{version}/page-frame.html`，其中 {appid} 为小程序的 appid，{version} 为小程序的版本号，版本号为 0 表示为开发版、体验版以及审核版本，版本号为 devtools 表示为开发者工具，其余为正式版本； */
        referrerPolicy: string
        /** 音频资源的地址，用于直接播放。[2.2.3](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 开始支持云文件ID */
        src: string
        /** 开始播放的位置（单位：s），默认为 0 */
        startTime: number
        /** 需要基础库： `1.9.90`
         *
         * 音量。范围 0~1。默认为 1 */
        volume: number
        /** [InnerAudioContext.destroy()](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.destroy.html)
         *
         * 销毁当前实例 */
        destroy(): void
        /** [InnerAudioContext.offCanplay(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.offCanplay.html)
*
* 需要基础库： `1.9.0`
*
* 移除音频进入可以播放状态的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onCanplay(listener)
InnerAudioContext.offCanplay(listener) // 需传入与监听时同一个的函数对象
``` */
        offCanplay(
            /** onCanplay 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffCanplayCallback
        ): void
        /** [InnerAudioContext.offEnded(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.offEnded.html)
*
* 需要基础库： `1.9.0`
*
* 移除音频自然播放至结束的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onEnded(listener)
InnerAudioContext.offEnded(listener) // 需传入与监听时同一个的函数对象
``` */
        offEnded(
            /** onEnded 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffEndedCallback
        ): void
        /** [InnerAudioContext.offError(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.offError.html)
*
* 需要基础库： `1.9.0`
*
* 移除音频播放错误事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onError(listener)
InnerAudioContext.offError(listener) // 需传入与监听时同一个的函数对象
``` */
        offError(
            /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: InnerAudioContextOffErrorCallback
        ): void
        /** [InnerAudioContext.offPause(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.offPause.html)
*
* 需要基础库： `1.9.0`
*
* 移除音频暂停事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onPause(listener)
InnerAudioContext.offPause(listener) // 需传入与监听时同一个的函数对象
``` */
        offPause(
            /** onPause 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffPauseCallback
        ): void
        /** [InnerAudioContext.offPlay(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.offPlay.html)
*
* 需要基础库： `1.9.0`
*
* 移除音频播放事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onPlay(listener)
InnerAudioContext.offPlay(listener) // 需传入与监听时同一个的函数对象
``` */
        offPlay(
            /** onPlay 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffPlayCallback
        ): void
        /** [InnerAudioContext.offSeeked(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.offSeeked.html)
*
* 需要基础库： `1.9.0`
*
* 移除音频完成跳转操作的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onSeeked(listener)
InnerAudioContext.offSeeked(listener) // 需传入与监听时同一个的函数对象
``` */
        offSeeked(
            /** onSeeked 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffSeekedCallback
        ): void
        /** [InnerAudioContext.offSeeking(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.offSeeking.html)
*
* 需要基础库： `1.9.0`
*
* 移除音频进行跳转操作的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onSeeking(listener)
InnerAudioContext.offSeeking(listener) // 需传入与监听时同一个的函数对象
``` */
        offSeeking(
            /** onSeeking 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffSeekingCallback
        ): void
        /** [InnerAudioContext.offStop(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.offStop.html)
*
* 需要基础库： `1.9.0`
*
* 移除音频停止事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onStop(listener)
InnerAudioContext.offStop(listener) // 需传入与监听时同一个的函数对象
``` */
        offStop(
            /** onStop 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffStopCallback
        ): void
        /** [InnerAudioContext.offTimeUpdate(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.offTimeUpdate.html)
*
* 需要基础库： `1.9.0`
*
* 移除音频播放进度更新事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onTimeUpdate(listener)
InnerAudioContext.offTimeUpdate(listener) // 需传入与监听时同一个的函数对象
``` */
        offTimeUpdate(
            /** onTimeUpdate 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: InnerAudioContextOffTimeUpdateCallback
        ): void
        /** [InnerAudioContext.offWaiting(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.offWaiting.html)
*
* 需要基础库： `1.9.0`
*
* 移除音频加载中事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onWaiting(listener)
InnerAudioContext.offWaiting(listener) // 需传入与监听时同一个的函数对象
``` */
        offWaiting(
            /** onWaiting 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffWaitingCallback
        ): void
        /** [InnerAudioContext.onCanplay(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.onCanplay.html)
         *
         * 监听音频进入可以播放状态的事件。但不保证后面可以流畅播放 */
        onCanplay(
            /** 音频进入可以播放状态的事件的监听函数 */
            listener: OnCanplayCallback
        ): void
        /** [InnerAudioContext.onEnded(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.onEnded.html)
         *
         * 监听音频自然播放至结束的事件 */
        onEnded(
            /** 音频自然播放至结束的事件的监听函数 */
            listener: OnEndedCallback
        ): void
        /** [InnerAudioContext.onError(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.onError.html)
         *
         * 监听音频播放错误事件
         *
         * **Tips**
         *
         * 1. errCode=100001 时，如若 errMsg 中有 INNERCODE -11828 ，请先检查 response header 是否缺少 Content-Length
         * 2. errCode=100001 时，如若 errMsg 中有 systemErrCode:200333420，请检查文件编码格式和 fileExtension 是否一致 */
        onError(
            /** 音频播放错误事件的监听函数 */
            listener: InnerAudioContextOnErrorCallback
        ): void
        /** [InnerAudioContext.onPause(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.onPause.html)
         *
         * 监听音频暂停事件 */
        onPause(
            /** 音频暂停事件的监听函数 */
            listener: OnPauseCallback
        ): void
        /** [InnerAudioContext.onPlay(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.onPlay.html)
         *
         * 监听音频播放事件 */
        onPlay(
            /** 音频播放事件的监听函数 */
            listener: OnPlayCallback
        ): void
        /** [InnerAudioContext.onSeeked(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.onSeeked.html)
         *
         * 监听音频完成跳转操作的事件 */
        onSeeked(
            /** 音频完成跳转操作的事件的监听函数 */
            listener: OnSeekedCallback
        ): void
        /** [InnerAudioContext.onSeeking(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.onSeeking.html)
         *
         * 监听音频进行跳转操作的事件 */
        onSeeking(
            /** 音频进行跳转操作的事件的监听函数 */
            listener: OnSeekingCallback
        ): void
        /** [InnerAudioContext.onStop(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.onStop.html)
         *
         * 监听音频停止事件 */
        onStop(
            /** 音频停止事件的监听函数 */
            listener: InnerAudioContextOnStopCallback
        ): void
        /** [InnerAudioContext.onTimeUpdate(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.onTimeUpdate.html)
         *
         * 监听音频播放进度更新事件 */
        onTimeUpdate(
            /** 音频播放进度更新事件的监听函数 */
            listener: InnerAudioContextOnTimeUpdateCallback
        ): void
        /** [InnerAudioContext.onWaiting(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.onWaiting.html)
         *
         * 监听音频加载中事件。当音频因为数据不足，需要停下来加载时会触发 */
        onWaiting(
            /** 音频加载中事件的监听函数 */
            listener: OnWaitingCallback
        ): void
        /** [InnerAudioContext.pause()](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.pause.html)
         *
         * 暂停。暂停后的音频再播放会从暂停处开始播放 */
        pause(): void
        /** [InnerAudioContext.play()](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.play.html)
         *
         * 播放 */
        play(): void
        /** [InnerAudioContext.seek(number position)](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.seek.html)
         *
         * 跳转到指定位置 */
        seek(
            /** 跳转的时间，单位 s。精确到小数点后 3 位，即支持 ms 级别精确度 */
            position: number
        ): void
        /** [InnerAudioContext.stop()](https://developers.weixin.qq.com/minigame/dev/api/media/audio/InnerAudioContext.stop.html)
         *
         * 停止。停止后的音频再播放会从头开始播放。 */
        stop(): void
    }
interface Video {
        /** 视频是否自动播放 */
        autoplay: boolean
        /** 需要基础库： `2.12.0`
         *
         * 视频背景颜色 */
        backgroundColor: string
        /** 视频是否显示控件 */
        controls: boolean
        /** 是否启用手势控制播放进度 */
        enablePlayGesture: boolean
        /** 是否启用手势控制播放进度 */
        enableProgressGesture: boolean
        /** 视频的高度 */
        height: number
        /** 视频的初始播放位置，单位为 s 秒 */
        initialTime: number
        /** 视频是否为直播 */
        live: boolean
        /** 视频是否是否循环播放 */
        loop: boolean
        /** 视频是否禁音播放 */
        muted: boolean
        /** 需要基础库： `2.4.0`
         *
         * 视频是否遵从系统静音开关设置（仅iOS） */
        obeyMuteSwitch: boolean
        /** 视频的缩放模式 */
        objectFit: string
        /** 视频播放到末尾时触发的回调函数 */
        onended: (...args: any[]) => any
        /** 视频发生错误时触发的回调函数 */
        onerror: (...args: any[]) => any
        /** 视频暂停时触发的回调函数 */
        onpause: (...args: any[]) => any
        /** 视频开始播放时触发的回调函数 */
        onplay: (...args: any[]) => any
        /** 视频下载（缓冲）时周期性触发的回调函数 */
        onprogress: (...args: any[]) => any
        /** 每当视频播放进度更新时触发的回调函数 */
        ontimeupdate: (...args: any[]) => any
        /** 视频由于需要缓冲下一帧而停止时触发的回调函数 */
        onwaiting: (...args: any[]) => any
        /** 视频的播放速率，有效值有 0.5、0.8、1.0、1.25、1.5 */
        playbackRate: number
        /** 视频的封面 */
        poster: string
        /** 是否显示视频中央的播放按钮 */
        showCenterPlayBtn: boolean
        /** 需要基础库： `2.12.0`
         *
         * 是否显示视频底部进度条，controls为true时才生效 */
        showProgress: boolean
        /** 需要基础库： `2.12.0`
         *
         * 是否显示视频控制栏进度条，controls为true时才生效 */
        showProgressInControlMode: boolean
        /** 视频的资源地址 */
        src: string
        /** 视频的宽度 */
        width: number
        /** 视频的左上角横坐标 */
        x: number
        /** 视频的左上角纵坐标 */
        y: number
        /** [Promise Video.exitFullScreen()](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.exitFullScreen.html)
         *
         * 视频退出全屏 */
        exitFullScreen(): Promise<any>
        /** [Promise Video.pause()](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.pause.html)
         *
         * 暂停视频 */
        pause(): Promise<any>
        /** [Promise Video.play()](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.play.html)
         *
         * 播放视频 */
        play(): Promise<any>
        /** [Promise Video.requestFullScreen(number direction)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.requestFullScreen.html)
         *
         * 视频全屏 */
        requestFullScreen(
            /** 设置全屏时视频的方向
             *
             * 参数 direction 可选值：
             * - 0: 正常竖向;
             * - 90: 屏幕逆时针90度;
             * - -90: 屏幕顺时针90度; */
            direction: 0 | 90 | -90
        ): Promise<any>
        /** [Promise Video.seek(number time)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.seek.html)
         *
         * 视频跳转 */
        seek(
            /** 视频跳转到指定位置，单位为 s 秒 */
            time: number
        ): Promise<any>
        /** [Promise Video.stop()](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.stop.html)
         *
         * 停止视频 */
        stop(): Promise<any>
        /** [Video.destroy()](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.destroy.html)
         *
         * 销毁视频 */
        destroy(): void
        /** [Video.offEnded(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.offEnded.html)
*
* 移除视频播放到末尾事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

Video.onEnded(listener)
Video.offEnded(listener) // 需传入与监听时同一个的函数对象
``` */
        offEnded(
            /** onEnded 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffEndedCallback
        ): void
        /** [Video.offError(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.offError.html)
*
* 移除视频错误事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

Video.onError(listener)
Video.offError(listener) // 需传入与监听时同一个的函数对象
``` */
        offError(
            /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: VideoOffErrorCallback
        ): void
        /** [Video.offPause(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.offPause.html)
*
* 移除视频暂停事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

Video.onPause(listener)
Video.offPause(listener) // 需传入与监听时同一个的函数对象
``` */
        offPause(
            /** onPause 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffPauseCallback
        ): void
        /** [Video.offPlay(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.offPlay.html)
*
* 移除视频播放事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

Video.onPlay(listener)
Video.offPlay(listener) // 需传入与监听时同一个的函数对象
``` */
        offPlay(
            /** onPlay 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffPlayCallback
        ): void
        /** [Video.offProgress(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.offProgress.html)
*
* 移除视频下载（缓冲）事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

Video.onProgress(listener)
Video.offProgress(listener) // 需传入与监听时同一个的函数对象
``` */
        offProgress(
            /** onProgress 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffProgressCallback
        ): void
        /** [Video.offTimeUpdate(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.offTimeUpdate.html)
*
* 移除视频播放进度更新事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

Video.onTimeUpdate(listener)
Video.offTimeUpdate(listener) // 需传入与监听时同一个的函数对象
``` */
        offTimeUpdate(
            /** onTimeUpdate 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: VideoOffTimeUpdateCallback
        ): void
        /** [Video.offWaiting(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.offWaiting.html)
*
* 移除视频由于需要缓冲下一帧而停止时触发的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

Video.onWaiting(listener)
Video.offWaiting(listener) // 需传入与监听时同一个的函数对象
``` */
        offWaiting(
            /** onWaiting 传入的监听函数。不传此参数则移除所有监听函数。 */
            listener?: OffWaitingCallback
        ): void
        /** [Video.onEnded(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.onEnded.html)
         *
         * 监听视频播放到末尾事件 */
        onEnded(
            /** 视频播放到末尾事件的监听函数 */
            listener: OnEndedCallback
        ): void
        /** [Video.onError(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.onError.html)
         *
         * 监听视频错误事件 */
        onError(
            /** 视频错误事件的监听函数 */
            listener: VideoOnErrorCallback
        ): void
        /** [Video.onPause(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.onPause.html)
         *
         * 监听视频暂停事件 */
        onPause(
            /** 视频暂停事件的监听函数 */
            listener: OnPauseCallback
        ): void
        /** [Video.onPlay(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.onPlay.html)
         *
         * 监听视频播放事件 */
        onPlay(
            /** 视频播放事件的监听函数 */
            listener: OnPlayCallback
        ): void
        /** [Video.onProgress(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.onProgress.html)
         *
         * 监听视频下载（缓冲）事件 */
        onProgress(
            /** 视频下载（缓冲）事件的监听函数 */
            listener: OnProgressCallback
        ): void
        /** [Video.onTimeUpdate(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.onTimeUpdate.html)
         *
         * 监听视频播放进度更新事件 */
        onTimeUpdate(
            /** 视频播放进度更新事件的监听函数 */
            listener: VideoOnTimeUpdateCallback
        ): void
        /** [Video.onWaiting(function listener)](https://developers.weixin.qq.com/minigame/dev/api/media/video/Video.onWaiting.html)
         *
         * 监听视频由于需要缓冲下一帧而停止时触发 */
        onWaiting(
            /** 的监听函数 */
            listener: OnWaitingCallback
        ): void
    }
interface SocketTask {
        /** [SocketTask.close(Object object)](https://developers.weixin.qq.com/minigame/dev/api/network/websocket/SocketTask.close.html)
         *
         * 关闭 WebSocket 连接 */
        close(option: SocketTaskCloseOption): void
        /** [SocketTask.onClose(function listener)](https://developers.weixin.qq.com/minigame/dev/api/network/websocket/SocketTask.onClose.html)
         *
         * 监听 WebSocket 连接关闭事件 */
        onClose(
            /** WebSocket 连接关闭事件的监听函数 */
            listener: SocketTaskOnCloseCallback
        ): void
        /** [SocketTask.onError(function listener)](https://developers.weixin.qq.com/minigame/dev/api/network/websocket/SocketTask.onError.html)
         *
         * 监听 WebSocket 错误事件 */
        onError(
            /** WebSocket 错误事件的监听函数 */
            listener: UDPSocketOnErrorCallback
        ): void
        /** [SocketTask.onMessage(function listener)](https://developers.weixin.qq.com/minigame/dev/api/network/websocket/SocketTask.onMessage.html)
         *
         * 监听 WebSocket 接收到服务器的消息事件 */
        onMessage(
            /** WebSocket 接收到服务器的消息事件的监听函数 */
            listener: SocketTaskOnMessageCallback
        ): void
        /** [SocketTask.onOpen(function listener)](https://developers.weixin.qq.com/minigame/dev/api/network/websocket/SocketTask.onOpen.html)
         *
         * 监听 WebSocket 连接打开事件 */
        onOpen(
            /** WebSocket 连接打开事件的监听函数 */
            listener: OnOpenCallback
        ): void
        /** [SocketTask.send(Object object)](https://developers.weixin.qq.com/minigame/dev/api/network/websocket/SocketTask.send.html)
         *
         * 通过 WebSocket 连接发送数据 */
        send(option: SocketTaskSendOption): void
    }
interface VideoDecoder {
        /** [Object VideoDecoder.getFrameData()](https://developers.weixin.qq.com/minigame/dev/api/media/video-decoder/VideoDecoder.getFrameData.html)
         *
         * 需要基础库： `2.11.1`
         *
         * 获取下一帧的解码数据 */
        getFrameData(): FrameDataOptions
        /** [Promise VideoDecoder.remove()](https://developers.weixin.qq.com/minigame/dev/api/media/video-decoder/VideoDecoder.remove.html)
         *
         * 需要基础库： `2.11.1`
         *
         * 移除解码器 */
        remove(): Promise<any>
        /** [Promise VideoDecoder.seek(number position)](https://developers.weixin.qq.com/minigame/dev/api/media/video-decoder/VideoDecoder.seek.html)
         *
         * 需要基础库： `2.11.1`
         *
         * 跳到某个时间点解码 */
        seek(
            /** 跳转的解码位置，单位 ms */
            position: number
        ): Promise<any>
        /** [Promise VideoDecoder.start(Object object)](https://developers.weixin.qq.com/minigame/dev/api/media/video-decoder/VideoDecoder.start.html)
         *
         * 需要基础库： `2.11.1`
         *
         * 开始解码 */
        start(option: VideoDecoderStartOption): Promise<any>
        /** [Promise VideoDecoder.stop()](https://developers.weixin.qq.com/minigame/dev/api/media/video-decoder/VideoDecoder.stop.html)
         *
         * 需要基础库： `2.11.1`
         *
         * 停止解码 */
        stop(): Promise<any>
        /** [VideoDecoder.off(string eventName, function callback)](https://developers.weixin.qq.com/minigame/dev/api/media/video-decoder/VideoDecoder.off.html)
         *
         * 需要基础库： `2.11.1`
         *
         * 取消监听录制事件。当对应事件触发时，该回调函数不再执行 */
        off(
            /** 事件名 */
            eventName: string,
            /** 事件触发时执行的回调函数 */
            callback: (...args: any[]) => any
        ): void
        /** [VideoDecoder.on(string eventName, function callback)](https://developers.weixin.qq.com/minigame/dev/api/media/video-decoder/VideoDecoder.on.html)
         *
         * 需要基础库： `2.11.1`
         *
         * 注册监听录制事件的回调函数。当对应事件触发时，回调函数会被执行 */
        on(
            /** 事件名
             *
             * 参数 eventName 可选值：
             * - 'start': 开始事件。返回 {width, height};
             * - 'stop': 结束事件。;
             * - 'seek': seek 完成事件。;
             * - 'bufferchange': 缓冲区变化事件。;
             * - 'ended': 解码结束事件。; */
            eventName: 'start' | 'stop' | 'seek' | 'bufferchange' | 'ended',
            /** 事件触发时执行的回调函数 */
            callback: (...args: any[]) => any
        ): void
    }
type OffCanplayCallback = (res: GeneralCallbackResult) => void
type OffEndedCallback = (res: GeneralCallbackResult) => void
type InnerAudioContextOffErrorCallback = (
        result: InnerAudioContextOnErrorListenerResult
    ) => void
type OffPauseCallback = (res: GeneralCallbackResult) => void
type OffPlayCallback = (res: GeneralCallbackResult) => void
type OffSeekedCallback = (res: GeneralCallbackResult) => void
type OffSeekingCallback = (res: GeneralCallbackResult) => void
type OffStopCallback = (res: GeneralCallbackResult) => void
type InnerAudioContextOffTimeUpdateCallback = (
        res: GeneralCallbackResult
    ) => void
type OffWaitingCallback = (res: GeneralCallbackResult) => void
type OnCanplayCallback = (res: GeneralCallbackResult) => void
type OnEndedCallback = (res: GeneralCallbackResult) => void
type InnerAudioContextOnErrorCallback = (
        result: InnerAudioContextOnErrorListenerResult
    ) => void
type OnPauseCallback = (res: GeneralCallbackResult) => void
type OnPlayCallback = (res: GeneralCallbackResult) => void
type OnSeekedCallback = (res: GeneralCallbackResult) => void
type OnSeekingCallback = (res: GeneralCallbackResult) => void
type InnerAudioContextOnStopCallback = (res: GeneralCallbackResult) => void
type InnerAudioContextOnTimeUpdateCallback = (
        res: GeneralCallbackResult
    ) => void
type OnWaitingCallback = (res: GeneralCallbackResult) => void
type VideoOffErrorCallback = (result: VideoOnErrorListenerResult) => void
type OffProgressCallback = (result: OnProgressListenerResult) => void
type VideoOffTimeUpdateCallback = (
        result: OnTimeUpdateListenerResult
    ) => void
type VideoOnErrorCallback = (result: VideoOnErrorListenerResult) => void
type OnProgressCallback = (result: OnProgressListenerResult) => void
type VideoOnTimeUpdateCallback = (
        result: OnTimeUpdateListenerResult
    ) => void
interface SocketTaskCloseOption {
        /** 一个数字值表示关闭连接的状态号，表示连接被关闭的原因。 */
        code?: number
        /** 接口调用结束的回调函数（调用成功、失败都会执行） */
        complete?: SocketTaskCloseCompleteCallback
        /** 接口调用失败的回调函数 */
        fail?: SocketTaskCloseFailCallback
        /** 一个可读的字符串，表示连接被关闭的原因。这个字符串必须是不长于 123 字节的 UTF-8 文本（不是字符）。 */
        reason?: string
        /** 接口调用成功的回调函数 */
        success?: SocketTaskCloseSuccessCallback
    }
type SocketTaskOnCloseCallback = (
        result: SocketTaskOnCloseListenerResult
    ) => void
type UDPSocketOnErrorCallback = (result: GeneralCallbackResult) => void
type SocketTaskOnMessageCallback = (
        result: SocketTaskOnMessageListenerResult
    ) => void
type OnOpenCallback = (result: OnOpenListenerResult) => void
interface SocketTaskSendOption {
        /** 需要发送的内容 */
        data: string | ArrayBuffer
        /** 接口调用结束的回调函数（调用成功、失败都会执行） */
        complete?: SendCompleteCallback
        /** 接口调用失败的回调函数 */
        fail?: SendFailCallback
        /** 接口调用成功的回调函数 */
        success?: SendSuccessCallback
    }
interface FrameDataOptions {
        /** 帧数据 */
        data: ArrayBuffer
        /** 帧数据高度 */
        height: number
        /** 帧原始 dts */
        pkDts: number
        /** 帧原始 pts */
        pkPts: number
        /** 帧数据宽度 */
        width: number
    }
interface VideoDecoderStartOption {
        /** 需要解码的视频源文件。基础库 2.13.0 以下的版本只支持本地路径。 2.13.0 开始支持 http:// 和 https:// 协议的远程路径。 */
        source: string
        /** 需要基础库： `2.15.0`
         *
         * 是否不需要音频轨道 */
        abortAudio?: boolean
        /** 需要基础库： `2.15.0`
         *
         * 是否不需要视频轨道 */
        abortVideo?: boolean
        /** 解码模式。0：按 pts 解码；1：以最快速度解码 */
        mode?: number
    }
interface GeneralCallbackResult {
        /** 错误信息 */
        errMsg: string
    }
interface InnerAudioContextOnErrorListenerResult {
        /** 可选值：
         * - 10001: 系统错误;
         * - 10002: 网络错误;
         * - 10003: 文件错误;
         * - 10004: 格式错误;
         * - -1: 未知错误; */
        errCode: 10001 | 10002 | 10003 | 10004 | -1
        errMsg: string
    }
interface VideoOnErrorListenerResult {
        /** 错误信息
         *
         * 可选值：
         * - 'MEDIA_ERR_NETWORK': 当下载时发生错误;
         * - 'MEDIA_ERR_DECODE': 当解码时发生错误;
         * - 'MEDIA_ERR_SRC_NOT_SUPPORTED': video 的 src 属性是不支持的资源类型; */
        errMsg: string
    }
interface OnProgressListenerResult {
        /** 当前的缓冲进度，缓冲进度区间为 (0~100]，100表示缓冲完成 */
        buffered: number
        /** 视频的总时长，单位为秒 */
        duration: number
    }
interface OnTimeUpdateListenerResult {
        /** 视频的总时长，单位为秒 */
        duration: number
        /** 当前的播放位置，单位为秒 */
        position: number
    }
type SocketTaskCloseCompleteCallback = (res: GeneralCallbackResult) => void
type SocketTaskCloseFailCallback = (res: GeneralCallbackResult) => void
type SocketTaskCloseSuccessCallback = (res: GeneralCallbackResult) => void
interface SocketTaskOnCloseListenerResult {
        /** 一个数字值表示关闭连接的状态号，表示连接被关闭的原因。 */
        code: number
        /** 一个可读的字符串，表示连接被关闭的原因。 */
        reason: string
    }
interface SocketTaskOnMessageListenerResult {
        /** 服务器返回的消息 */
        data: string | ArrayBuffer
    }
interface OnOpenListenerResult {
        /** 需要基础库： `2.0.0`
         *
         * 连接成功的 HTTP 响应 Header */
        header: IAnyObject
        /** 需要基础库： `2.10.4`
         *
         * 网络请求过程中一些调试信息 */
        profile: SocketProfile
    }
type SendCompleteCallback = (res: GeneralCallbackResult) => void
type SendFailCallback = (res: GeneralCallbackResult) => void
type SendSuccessCallback = (res: GeneralCallbackResult) => void
type IAnyObject = Record<string, any>
interface SocketProfile {
        /** 完成建立连接的时间（完成握手），如果是持久连接，则与 fetchStart 值相等。注意如果在传输层发生了错误且重新建立连接，则这里显示的是新建立的连接完成的时间。注意这里握手结束，包括安全连接建立完成、SOCKS 授权通过 */
        connectEnd: number
        /** 开始建立连接的时间，如果是持久连接，则与 fetchStart 值相等。注意如果在传输层发生了错误且重新建立连接，则这里显示的是新建立的连接开始的时间 */
        connectStart: number
        /** 上层请求到返回的耗时 */
        cost: number
        /** DNS 域名查询完成的时间，如果使用了本地缓存（即无 DNS 查询）或持久连接，则与 fetchStart 值相等 */
        domainLookUpEnd: number
        /** DNS 域名查询开始的时间，如果使用了本地缓存（即无 DNS 查询）或持久连接，则与 fetchStart 值相等 */
        domainLookUpStart: number
        /** 组件准备好使用 SOCKET 建立请求的时间，这发生在检查本地缓存之前 */
        fetchStart: number
        /** 握手耗时 */
        handshakeCost: number
        /** 单次连接的耗时，包括 connect ，tls */
        rtt: number
    }
}
