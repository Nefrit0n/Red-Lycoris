package domain

import "testing"

func TestProjectValidate(t *testing.T) {
	tests := []struct {
		name    string
		project Project
		wantErr bool
	}{
		{"valid name", Project{Name: "My Project"}, false},
		{"empty name", Project{Name: ""}, true},
		{"name at limit", Project{Name: string(make([]byte, 255))}, false},
		{"name over limit", Project{Name: string(make([]byte, 256))}, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.project.Validate()
			if (err != nil) != tc.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tc.wantErr)
			}
		})
	}
}

func TestTeamValidate(t *testing.T) {
	tests := []struct {
		name    string
		team    Team
		wantErr bool
	}{
		{"valid name", Team{Name: "Backend"}, false},
		{"empty name", Team{Name: ""}, true},
		{"whitespace only", Team{Name: "   "}, true},
		{"name at limit", Team{Name: string(make([]byte, 128))}, false},
		{"name over limit", Team{Name: string(make([]byte, 129))}, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.team.Validate()
			if (err != nil) != tc.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tc.wantErr)
			}
		})
	}
}
