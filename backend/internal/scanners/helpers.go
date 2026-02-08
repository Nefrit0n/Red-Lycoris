package scanners

import "os"

// osRename wraps os.Rename, ignoring missing source files.
func osRename(src, dst string) error {
	if _, err := os.Stat(src); os.IsNotExist(err) {
		return nil
	}
	return os.Rename(src, dst)
}
