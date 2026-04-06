#compdef har-o-scope
# zsh completion for har-o-scope
# Install: source completions/har-o-scope.zsh
# Or copy to a directory in your $fpath

_har_o_scope() {
    local -a commands
    commands=(
        'analyze:Analyze a HAR file for performance and security issues'
        'diff:Compare two HAR files for regressions'
        'sanitize:Strip secrets and sensitive data from a HAR file'
        'validate:Validate HAR file structure and custom rules'
        'help:Display help for a command'
    )

    _arguments -C \
        '(-V --version)'{-V,--version}'[Output version number]' \
        '(-h --help)'{-h,--help}'[Display help]' \
        '1:command:->command' \
        '*::arg:->args'

    case $state in
        command)
            _describe 'command' commands
            ;;
        args)
            case $words[1] in
                analyze)
                    _arguments \
                        '(-f --format)'{-f,--format}'[Output format]:format:(text json markdown)' \
                        '--sarif[Output SARIF 2.1.0 JSON]' \
                        '--ci[Output GitHub-compatible annotations]' \
                        '--baseline[Compare against baseline HAR]:file:_files -g "*.har"' \
                        '--threshold[Minimum health score]:score:' \
                        '--verbose[Show per-entry timing details]' \
                        '--rules[Custom YAML rules]:path:_files -g "*.{yaml,yml}"' \
                        '--demo[Analyze built-in demo HAR]' \
                        '--no-color[Disable colored output]' \
                        '*:file:_files -g "*.har"'
                    ;;
                diff)
                    _arguments \
                        '(-f --format)'{-f,--format}'[Output format]:format:(text json markdown)' \
                        '--no-color[Disable colored output]' \
                        '*:file:_files -g "*.har"'
                    ;;
                sanitize)
                    _arguments \
                        '(-o --output)'{-o,--output}'[Output file]:file:_files' \
                        '--mode[Sanitization mode]:mode:(aggressive selective)' \
                        '*:file:_files -g "*.har"'
                    ;;
                validate)
                    _arguments \
                        '--rules[Custom YAML rules to validate]:path:_files -g "*.{yaml,yml}"' \
                        '*:file:_files -g "*.{har,yaml,yml}"'
                    ;;
            esac
            ;;
    esac
}

_har_o_scope "$@"
