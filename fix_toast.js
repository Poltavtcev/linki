const fs = require('fs');
let code = fs.readFileSync('pages/inbox.tsx', 'utf8');

code = code.replace(
  '          setReplyText("");\n          onClose(); // Optional: close modal\n        } catch (err) {\n          // just catch\n        } finally {',
  '          toast.success("LinkedIn reply queued");\n          setReplyText("");\n          onClose();\n        } catch (err: any) {\n          toast.error(err.message ?? "Failed to queue reply");\n        } finally {'
);

fs.writeFileSync('pages/inbox.tsx', code);
