 网名生成器
function generateName() {
    const prefix = [星尘, 星河, 星云, 星野, 星眠, 星屿, 星澜, 星雾];
    const suffix = [低语, 入梦, 远航, 私语, 幻梦, 微光, 晚风, 破晓];
    const randomPrefix = prefix[Math.floor(Math.random()  prefix.length)];
    const randomSuffix = suffix[Math.floor(Math.random()  suffix.length)];
    document.getElementById(nameResult).innerText = randomPrefix + randomSuffix;
}

 运势测算
function showFortune() {
    const fortunes = [
        今日运势极佳，适合开展新计划✨,
        今日运势平稳，稳扎稳打即可👍,
        今日运势小吉，注意把握机会🌟,
        今日运势尚可，避免冲动决策💫
    ];
    const randomFortune = fortunes[Math.floor(Math.random()  fortunes.length)];
    document.getElementById(fortuneResult).innerText = randomFortune;
}

 表情包生成（简化版）
function generateEmoji() {
    const text = prompt(请输入表情包文字：);
    if (text) {
        alert(`已生成表情包：${text}`);
         可扩展canvas绘制表情包
    }
}