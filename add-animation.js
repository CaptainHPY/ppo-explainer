const fs = require('fs');
const filePath = 'app/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add CSS animation styles and Fragment wrapper
const animationStyle = `      <style>{\`
        @keyframes scrollDash {
          to {
            stroke-dashoffset: -10px;
          }
        }
        .dash-animation {
          animation: scrollDash 1s linear infinite;
        }
      \`}</style>`;

// Add fragment and style after "return ("
content = content.replace(
  'return (',
  `return (
    <>
      ${animationStyle}
`
);

// Add closing fragment before final ")"
content = content.replace(
  '</div>\n  )\n}',
  `</div>
    </>
  )
}`
);

// Add className to all strokeDasharray lines - for lines
content = content.replace(/(<line[^>]*strokeDasharray="[^"]*")/g, '$1 className="dash-animation"');

// Add className to all strokeDasharray paths
content = content.replace(/(<path[^>]*strokeDasharray="[^"]*")/g, '$1 className="dash-animation"');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Animation added successfully!');
