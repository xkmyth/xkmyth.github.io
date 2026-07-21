import re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open(r'C:\Users\HUAWEI\.openclaw\workspace\xkmyth-temp\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

fixes = {
    'PPT 排版美化': """Ctrl+G 对象组合<br>
Ctrl+Shift+G 取消组合<br>
Ctrl+Alt+G 组合内选择对象<br>
Ctrl+D 快速复制/原位粘贴<br>
Ctrl+Shift+D 复制当前幻灯片<br>
Alt+F9 显示/隐藏参考线<br>
Alt+Shift+F9 显示/隐藏网格<br>
Ctrl+Shift+C 格式刷复制 / Ctrl+Shift+V 格式刷粘贴""",

    '网页资源保存技巧': """Ctrl+S 保存网页为离线文件<br>
右键图片选"另存为"保存本地<br>
视频右键可保存或复制视频链接<br>
F12 -> Network -> 筛选媒体类型下载资源<br>
使用浏览器插件批量下载图片<br>
网页截图：Ctrl+Shift+S 或 F12截图<br>
查看网页源代码 Ctrl+U 寻找资源链接<br>
使用浏览器"保存为PDF"存档网页""",

    '抓包基础概念': """HTTP 明文传输，数据内容可被直接查看<br>
HTTPS 加密传输，需安装证书才能解密查看<br>
GET 请求用于获取数据，参数在URL中<br>
POST 请求用于提交/上传数据，参数在body中<br>
请求头 Header：User-Agent、Cookie、Referer、Token<br>
状态码 2xx 成功 / 3xx 重定向 / 4xx 客户端错 / 5xx 服务器错<br>
JSON 格式接口数据便于前后端传输解析<br>
抓包本质：中间人代理拦截和查看网络请求响应""",

    '常见纠纷处理渠道': """人身财产安全受侵害立即拨打110报警<br>
消费纠纷拨打12315消费者投诉热线<br>
劳动纠纷先申请劳动仲裁，不服再向法院起诉<br>
网络诈骗拨打96110反诈中心或直接报警<br>
交通事故拨打122交警处理现场<br>
小额纠纷可走法院简易程序(5万以下)<br>
民事纠纷可寻求调解委员会调解<br>
发现违法信息可向网信办举报12377""",

    '安装验收收尾': """门窗开合顺畅，密封胶均匀无断裂<br>
厨卫五金安装牢固无晃动，下水不渗漏<br>
通电测试所有开关插座灯具功能正常<br>
开荒保洁后再进家具，避免刮花地板墙面<br>
空调/热水器预留位置合理，安装不遮挡插座<br>
踢脚线安装平整无缝隙，与墙面贴合<br>
美缝干透后检查有无脱落变色开裂<br>
所有质保卡、说明书、备用钥匙妥善保管""",

    '后期修图基础技巧': """先裁剪构图二次取景，再调整曝光对比色调<br>
适当提高锐化清晰度，让画面细节更清楚<br>
肤色不过度磨皮，保留自然皮肤质感<br>
善用色温/色调调整整体氛围风格<br>
HSL工具单独调整特定颜色的饱和/明度<br>
曲线工具精细控制高光、中间调、阴影<br>
高光阴影找回细节，避免死白死黑<br>
导出时选择适当压缩比，平衡画质与文件大小""",

    '厨房实用小窍门': """切洋葱放冰箱冷藏10分钟再切，不辣眼睛<br>
豆腐泡盐水15分钟，不易碎更入味<br>
铁锅烧热冒烟再放油，物理防粘锅<br>
厨房异味：柠檬皮+水煮开可去油腻味<br>
生肉解冻提前放冷藏室，不损口感不滋生细菌<br>
煮面条水开后加少许盐和油，不粘连更劲道<br>
砧板用白醋喷洒可杀菌去腥味<br>
油温七成热(筷子冒泡)是炒菜最佳温度""",

    '职场心态与成长建议': """正确看待挫折：把每次问题当成长机会<br>
主动承担：多做一些，多积累一份不可替代的经验<br>
持续学习：每周关注行业动态、新技术新趋势<br>
职业规划：1年短期技能目标+3年长期发展方向<br>
保持空杯心态：接受不同意见，持续进化自己<br>
建立个人品牌：持续输出专业内容积累口碑<br>
学会拒绝：不合理的需求果断说不，不内耗<br>
管理上级：主动汇报进度，让领导有掌控感""",

    '室内绿植养护小技巧': """见干见湿浇水：盆土干了再浇透，不长期积水<br>
绿萝龟背竹喜散光，避免阳光直射灼伤叶片<br>
多肉少浇水多光照，防止徒长和烂根<br>
施肥薄肥勤施，春夏生长季每月施1次稀薄液肥<br>
叶片定期喷水除尘，保持光合作用效率<br>
换盆选春秋季，比原盆大一号即可<br>
通风不良易生虫害，每月喷洒防虫药剂<br>
发财树/幸福树怕冷，冬季室温不低于10度""",

    '旅行饮食健康': """水土不服：喝当地瓶装水，不喝生水<br>
肠胃不适：随身带蒙脱石散、藿香正气水<br>
防晒必备：SPF50+防晒霜+墨镜+遮阳帽<br>
蚊虫叮咬：花露水/驱蚊液，东南亚需防疟疾<br>
晕车药：提前半小时服用茶苯海明片<br>
常用药包：退烧药、创可贴、碘伏、过敏药<br>
饮食安全：不吃路边无证摊，海鲜要彻底煮熟<br>
旅行保险：购买含医疗保障的旅行意外险""",

    '儿童手工推荐（简单安全）': """折纸飞机：A4纸折叠，简单易学锻炼动手能力<br>
彩泥DIY：捏小动物/水果，激发创造力想象力<br>
剪纸窗花：安全剪刀+彩纸，培养耐心与审美<br>
纸杯手工：纸杯变动物/花盆，变废为宝环保<br>
毛线画：用毛线粘在纸上做画，触感丰富有趣<br>
树叶拼贴：户外捡树叶制作创意拼贴画<br>
手指画：安全水彩手指涂抹，低龄宝宝最爱<br>
串珠手链：大孔珠子串手链，训练手眼协调""",

    '易开花花卉种植推荐': """太阳花：喜阳光耐旱，从播种到开花仅需2个月<br>
矮牵牛：花期超长(春到秋)，阳台悬挂盆栽首选<br>
长寿花：花期冬季至春，耐旱好打理，寓意吉祥<br>
天竺葵：花色丰富，春秋两季开花，适合窗台<br>
三角梅：南方全年开花，北方室内养护也能爆花<br>
茉莉花：夏季开花，香气浓郁，喜阳光和湿润<br>
蓝雪花：夏天蓝色花海，耐热耐晒病虫害少<br>
月季：选微型月季盆栽，勤花勤修剪每月都开""",

    '露营娱乐与应急处理': """露营娱乐：带扑克牌、风筝、桌游，增加休闲乐趣<br>
突发天气：遇到下雨大风，及时加固帐篷，必要时撤离<br>
受伤处理：轻微擦伤用急救包消毒包扎，严重受伤立即就医<br>
夜间安全：帐篷内用露营灯，不在帐篷内用明火炉具<br>
防虫防蛇：营地周围撒硫磺粉，穿长裤长袖扎紧裤腿<br>
用水用火：注意防火安全，离开确保火源完全熄灭<br>
噪音控制：晚10点后降低音量，不打扰他人<br>
无痕露营：带走所有垃圾，不破坏植被不污染环境"""
}

for title, new_content in fixes.items():
    pattern = r'(<div class="tool-card">.*?<h3>' + re.escape(title) + r'</h3>.*?<div id="[^"]*" class="tool-content">).*?(</div>\s*</div>\s*</div>)'
    result = re.sub(pattern, r'\1\n' + new_content + r'\2', content, count=1, flags=re.DOTALL)
    if result != content:
        print(f'[OK] {title}')
        content = result
    else:
        print(f'[FAIL] {title}')

# Add scroll-to-top button
if 'backToTop' not in content:
    scroll_btn = """
<style>
#backToTop{position:fixed;bottom:30px;right:30px;z-index:999;width:44px;height:44px;
border-radius:50%;background:linear-gradient(135deg,#3b82f6,#60a5fa);color:#fff;
border:none;font-size:20px;cursor:pointer;opacity:0;transform:translateY(20px);
transition:all 0.3s ease;box-shadow:0 4px 15px rgba(59,130,246,0.3)}
#backToTop.show{opacity:1;transform:translateY(0)}
#backToTop:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(59,130,246,0.5)}
.light #backToTop{background:linear-gradient(135deg,#2563eb,#3b82f6)}
</style>
<button id="backToTop" onclick="window.scrollTo({top:0,behavior:'smooth'})">&#8593;</button>
<script>window.addEventListener('scroll',function(){
document.getElementById('backToTop').classList.toggle('show',window.scrollY>300);});</script>
"""
    content = content.replace('<div class="footer">', scroll_btn + '\n<div class="footer">')
    print('[OK] 回到顶部按钮')

with open(r'C:\Users\HUAWEI\.openclaw\workspace\xkmyth-temp\index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print(f'[DONE] 共修复 {len(fixes)} 个不完整功能块')
