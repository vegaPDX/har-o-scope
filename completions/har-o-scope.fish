# fish completion for har-o-scope
# Install: source completions/har-o-scope.fish
# Or copy to ~/.config/fish/completions/

# Disable file completion by default
complete -c har-o-scope -f

# Global options
complete -c har-o-scope -s V -l version -d 'Output version number'
complete -c har-o-scope -s h -l help -d 'Display help'

# Subcommands
complete -c har-o-scope -n __fish_use_subcommand -a analyze -d 'Analyze a HAR file'
complete -c har-o-scope -n __fish_use_subcommand -a diff -d 'Compare two HAR files'
complete -c har-o-scope -n __fish_use_subcommand -a sanitize -d 'Strip secrets from a HAR file'
complete -c har-o-scope -n __fish_use_subcommand -a validate -d 'Validate HAR structure and rules'
complete -c har-o-scope -n __fish_use_subcommand -a help -d 'Display help for a command'

# analyze options
complete -c har-o-scope -n '__fish_seen_subcommand_from analyze' -s f -l format -x -a 'text json markdown' -d 'Output format'
complete -c har-o-scope -n '__fish_seen_subcommand_from analyze' -l sarif -d 'Output SARIF 2.1.0 JSON'
complete -c har-o-scope -n '__fish_seen_subcommand_from analyze' -l ci -d 'GitHub-compatible annotations'
complete -c har-o-scope -n '__fish_seen_subcommand_from analyze' -l baseline -r -F -d 'Baseline HAR file'
complete -c har-o-scope -n '__fish_seen_subcommand_from analyze' -l threshold -x -d 'Minimum health score'
complete -c har-o-scope -n '__fish_seen_subcommand_from analyze' -l verbose -d 'Show per-entry details'
complete -c har-o-scope -n '__fish_seen_subcommand_from analyze' -l rules -r -F -d 'Custom YAML rules'
complete -c har-o-scope -n '__fish_seen_subcommand_from analyze' -l demo -d 'Use built-in demo HAR'
complete -c har-o-scope -n '__fish_seen_subcommand_from analyze' -l no-color -d 'Disable colors'
complete -c har-o-scope -n '__fish_seen_subcommand_from analyze' -F

# diff options
complete -c har-o-scope -n '__fish_seen_subcommand_from diff' -s f -l format -x -a 'text json markdown' -d 'Output format'
complete -c har-o-scope -n '__fish_seen_subcommand_from diff' -l no-color -d 'Disable colors'
complete -c har-o-scope -n '__fish_seen_subcommand_from diff' -F

# sanitize options
complete -c har-o-scope -n '__fish_seen_subcommand_from sanitize' -s o -l output -r -F -d 'Output file'
complete -c har-o-scope -n '__fish_seen_subcommand_from sanitize' -l mode -x -a 'aggressive selective' -d 'Sanitization mode'
complete -c har-o-scope -n '__fish_seen_subcommand_from sanitize' -F

# validate options
complete -c har-o-scope -n '__fish_seen_subcommand_from validate' -l rules -r -F -d 'Custom YAML rules to validate'
complete -c har-o-scope -n '__fish_seen_subcommand_from validate' -F
