import JSZip from 'jszip';

const decode = (value) =>
  String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');

// Text of one paragraph: its runs joined, line breaks as spaces.
const paragraphText = (xml, runTag) =>
  decode(
    [...xml.replace(/<a:br\s*\/>|<text:line-break\s*\/>/gi, '<x> </x>').matchAll(new RegExp(`<${runTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${runTag}>`, 'g'))]
      .map((match) => match[1].replace(/<[^>]+>/g, ''))
      .join(''),
  ).replace(/\s+/g, ' ').trim();

const paragraphs = (xml, paragraphTag, runTag) =>
  [...xml.matchAll(new RegExp(`<${paragraphTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${paragraphTag}>`, 'g'))]
    .map((match) => paragraphText(match[0], runTag))
    .filter(Boolean);

const words = (text) => text.split(/\s+/).filter(Boolean).length;

// Date, footer and slide-number boxes repeat on every slide and carry no content,
// whether they are real placeholders or plain text boxes holding a date or number field.
const isFooter = (shape) =>
  /<p:ph\b[^>]*type="(dt|ftr|sldNum)"/.test(shape)
  || (/<a:fld\b[^>]*type="(slidenum|datetime\d*)"/.test(shape) && !paragraphText(shape.replace(/<a:fld\b[\s\S]*?<\/a:fld>/g, ''), 'a:t'));

// PowerPoint shapes in reading order, each with its paragraphs and how it looks.
const pptxShapes = (xml) =>
  [...xml.matchAll(/<p:(sp|graphicFrame)\b[\s\S]*?<\/p:\1>/g)]
    .map(([shape]) => ({
      lines: isFooter(shape) ? [] : paragraphs(shape, 'a:p', 'a:t'),
      titlePlaceholder: /<p:ph\b[^>]*type="(title|ctrTitle)"/.test(shape),
      prominent: /<a:rPr\b[^>]*\bb="1"/.test(shape) || Number(shape.match(/<a:rPr\b[^>]*\bsz="(\d+)"/)?.[1] || 0) >= 2000,
    }))
    .filter((shape) => shape.lines.length);

// OpenDocument text frames, with a "title" presentation class as the title.
const odpShapes = (xml) =>
  [...xml.matchAll(/<draw:frame\b[\s\S]*?<\/draw:frame>/g)]
    .filter(([frame]) => !/presentation:class="(date-time|footer|page-number)"/.test(frame))
    .map(([frame]) => ({
      lines: paragraphs(frame, 'text:(?:p|h)', 'text:(?:p|h|span)'),
      titlePlaceholder: /presentation:class="title"/.test(frame),
      prominent: false,
    }))
    .filter((shape) => shape.lines.length);

// Lines that sit where a title would but name no topic: the institution on a
// cover slide, or a closing "Thank you" slide.
const NOT_A_TOPIC = /\b(institute|university|college|department)\b|^(thank\s*you|thanks|any\s+(questions|queries)|questions\??|queries\??)\W*$/i;

// The slide's title: a title placeholder, or else the first short, bold or large
// line, as long as it is not a running header repeated across many slides.
const slideTitle = (shapes, isRepeated) => {
  const placeholder = shapes.find((shape) => shape.titlePlaceholder && !NOT_A_TOPIC.test(shape.lines.join(' ')));
  if (placeholder) return placeholder;
  const first = shapes.find((shape) => !shape.lines.every(isRepeated) && !NOT_A_TOPIC.test(shape.lines.join(' ')));
  const text = first?.lines.join(' ') || '';
  return first && first.prominent && first.lines.length <= 2 && words(text) <= 12 && !/[.;]$/.test(text) ? first : null;
};

// Slides in order: the title as a "## " heading, each paragraph on its own line,
// then a "-- n of total --" marker so topics can point to the slide they came from.
export const extractSlideText = async (buffer, extension) => {
  const archive = await JSZip.loadAsync(buffer);
  let slides;
  if (extension === '.odp') {
    const content = await archive.file(/^content\.xml$/i)[0]?.async('text');
    slides = [...String(content || '').matchAll(/<draw:page\b[\s\S]*?<\/draw:page>/g)].map(([page]) => odpShapes(page));
  } else {
    const names = Object.keys(archive.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((left, right) => Number(left.match(/(\d+)\.xml$/i)[1]) - Number(right.match(/(\d+)\.xml$/i)[1]));
    slides = [];
    for (const name of names) slides.push(pptxShapes(await archive.files[name].async('text')));
  }

  const slideCounts = new Map();
  for (const shapes of slides) {
    for (const line of new Set(shapes.flatMap((shape) => shape.lines))) slideCounts.set(line, (slideCounts.get(line) || 0) + 1);
  }
  const isRepeated = (line) => (slideCounts.get(line) || 0) >= Math.max(3, slides.length * 0.3);

  const total = slides.length;
  return slides
    .map((shapes, index) => {
      const title = slideTitle(shapes, isRepeated);
      const lines = shapes.flatMap((shape) => (shape === title ? [`## ${shape.lines.join(' ')}`] : shape.lines));
      return lines.length ? `${lines.join('\n')}\n-- ${index + 1} of ${total} --` : '';
    })
    .filter(Boolean)
    .join('\n');
};
