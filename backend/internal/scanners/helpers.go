package scanners

import (
	"fmt"
	"os"
)

// osRename wraps os.Rename, ignoring missing source files.
func osRename(src, dst string) error {
	if _, err := os.Stat(src); os.IsNotExist(err) {
		return nil
	}
	return os.Rename(src, dst)
}

func ensureOutputFile(path string, scanner string) error {
	if _, err := os.Stat(path); err == nil {
		return nil
	} else if os.IsNotExist(err) {
		return fmt.Errorf("%s did not produce output file: %s", scanner, path)
	} else {
		return fmt.Errorf("%s output file error: %w", scanner, err)
	}
}
