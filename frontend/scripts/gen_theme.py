"""Generate theme-green.css: maps the dark-theme Tailwind classes used in the
pages to the light green theme. Usage (from frontend/): python scripts/gen_theme.py src src/theme-green.css"""
import re, sys, pathlib

src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
text = ''
for f in list(src.glob('pages/*.jsx')) + list(src.glob('components/*.jsx')):
    if f.name not in ('HomeLanding.jsx', 'CareerGoal.jsx'):
        text += f.read_text(encoding='utf-8')

CLASS_RE = re.compile(r'(?<![\w-])((?:hover:|focus:|placeholder:|group-hover:)?(?:text|bg|border|from|via|to)-'
                      r'(white|black|gray|slate|cyan|sky|blue|indigo|purple|violet|fuchsia|pink|emerald|green|teal|amber|yellow|orange|rose|red)'
                      r'(?:-(\d{2,3}))?(?:/(\d{1,3}))?)(?![\w/-])')

COOL = {'cyan', 'sky', 'blue'}
VIOLET = {'indigo', 'purple', 'violet', 'fuchsia', 'pink', 'teal'}
GREEN = {'emerald', 'green'}
WARM = {'amber', 'yellow', 'orange'}
RED = {'rose', 'red'}
NEUTRAL = {'gray', 'slate'}


def text_color(fam, shade):
    s = shade or 500
    if fam == 'white' or (fam in NEUTRAL and s <= 100):
        return '#0f2e22'
    if fam in NEUTRAL:
        return '#334155' if s <= 200 else '#475569' if s <= 300 else '#64748b' if s <= 500 else None
    if fam in COOL:
        return '#0f5132' if s <= 100 else '#11653d' if s <= 200 else '#157a4a' if s <= 500 else None
    if fam in VIOLET:
        return '#115e59' if s <= 100 else '#0f766e' if s <= 200 else '#0d9488' if s <= 500 else None
    if fam in GREEN:
        return '#14532d' if s <= 100 else '#166534' if s <= 200 else '#15803d' if s <= 500 else None
    if fam in WARM:
        return '#78350f' if s <= 100 else '#92400e' if s <= 200 else '#b45309' if s <= 500 else None
    if fam in RED:
        return '#881337' if s <= 100 else '#9f1239' if s <= 200 else '#be123c' if s <= 500 else None
    return None


def bg_color(fam, shade, alpha):
    if alpha is None:
        # solid fills: only recolour the bright accent dots/bars
        if fam in COOL and (shade or 0) in (300, 400):
            return '#1f9d5c'
        if fam in NEUTRAL and (shade or 0) >= 900:
            return '#f3f7f4'
        return None
    strong = alpha >= 15
    if fam == 'white':
        return '#ffffff' if alpha <= 10 else '#f1f7f3' if alpha <= 30 else None
    if fam == 'black' or (fam in NEUTRAL and (shade or 0) >= 800):
        return '#f3f7f4' if alpha < 90 else '#ffffff'
    if fam in COOL or fam in GREEN:
        return '#d7efe0' if strong else '#eaf6ef'
    if fam in VIOLET:
        return '#d5eeea' if strong else '#e8f5f3'
    if fam in WARM:
        return '#fbe8c4' if strong else '#fdf4e3'
    if fam in RED:
        return '#fbd9de' if strong else '#fdecee'
    return None


def border_color(fam, shade, alpha):
    if fam == 'white':
        return '#dfe9e3' if alpha is not None and alpha <= 30 else None
    if fam in NEUTRAL and (shade or 0) >= 800:
        return '#ffffff'
    a = alpha or 100
    if fam in COOL or fam in GREEN or fam in VIOLET:
        return 'rgba(21, 122, 74, %.2f)' % (0.45 if a >= 40 else 0.24)
    if fam in WARM:
        return 'rgba(180, 83, 9, %.2f)' % (0.4 if a >= 40 else 0.28)
    if fam in RED:
        return 'rgba(190, 18, 60, %.2f)' % (0.4 if a >= 40 else 0.26)
    return None


GRADIENT = {'from': '#14532d', 'via': '#157a4a', 'to': '#1f9d5c'}


def esc(cls):
    return re.sub(r'([:/\[\]#.])', r'\\\1', cls)


rules = []
for cls, fam, shade, alpha in sorted(set(CLASS_RE.findall(text))):
    shade = int(shade) if shade else None
    alpha = int(alpha) if alpha else None
    variant, _, base = cls.rpartition(':')
    prop = base.split('-', 1)[0]
    pseudo = ':hover' if variant in ('hover', 'group-hover') else ':focus' if variant == 'focus' else '::placeholder' if variant == 'placeholder' else ''
    sel = f'.theme-green .{esc(cls)}{pseudo}:not(.native-green *)'
    if variant == 'group-hover':
        sel = f'.theme-green .group:hover .{esc(cls)}:not(.native-green *)'
    if prop == 'text':
        c = text_color(fam, shade)
        if c:
            rules.append(f'{sel} {{ color: {c}; }}')
    elif prop == 'bg':
        c = bg_color(fam, shade, alpha)
        if c:
            rules.append(f'{sel} {{ background-color: {c}; }}')
    elif prop == 'border':
        c = border_color(fam, shade, alpha)
        if c:
            rules.append(f'{sel} {{ border-color: {c}; }}')
    elif prop in GRADIENT and (fam in COOL or fam in VIOLET):
        c = GRADIENT[prop]
        if prop == 'from':
            rules.append(f'{sel} {{ --tw-gradient-from: {c} var(--tw-gradient-from-position); --tw-gradient-to: rgb(31 157 92 / 0) var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }}')
        elif prop == 'via':
            rules.append(f'{sel} {{ --tw-gradient-to: rgb(31 157 92 / 0) var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), {c} var(--tw-gradient-via-position), var(--tw-gradient-to); }}')
        else:
            rules.append(f'{sel} {{ --tw-gradient-to: {c} var(--tw-gradient-to-position); }}')

header = '/* Generated by gen_theme.py: maps the dark-theme utility classes in the pages to the green theme. */\n'
out.write_text(header + '\n'.join(rules) + '\n', encoding='utf-8')
print(len(rules), 'rules')
