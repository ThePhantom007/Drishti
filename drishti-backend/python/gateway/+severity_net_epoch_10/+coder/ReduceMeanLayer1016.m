classdef ReduceMeanLayer1016 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.
    %#codegen

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end

    methods(Static, Hidden)
        % Specify the properties of the class that will not be modified
        % after the first assignment.
        function p = matlabCodegenNontunableProperties(~)
            p = {
                % Constants, i.e., Vars, NumDims and all learnables and states
                'Vars'
                'NumDims'
                };
        end
    end


    methods(Static, Hidden)
        % Instantiate a codegenable layer instance from a MATLAB layer instance
        function this_cg = matlabCodegenToRedirected(mlInstance)
            this_cg = severity_net_epoch_10.coder.ReduceMeanLayer1016(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net_epoch_10.ReduceMeanLayer1016(cgInstance.Name);
            if isstruct(cgInstance.Vars)
                names = fieldnames(cgInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this_ml.Vars.(fieldname) = dlarray(cgInstance.Vars.(fieldname));
                end
            else
                this_ml.Vars = [];
            end
            this_ml.NumDims = cgInstance.NumDims;
        end
    end

    methods
        function this = ReduceMeanLayer1016(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_4_53'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net_epoch_10.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_4_53] = predict(this, x_blocks_blocks_4_47__)
            if isdlarray(x_blocks_blocks_4_47__)
                x_blocks_blocks_4_47_ = stripdims(x_blocks_blocks_4_47__);
            else
                x_blocks_blocks_4_47_ = x_blocks_blocks_4_47__;
            end
            x_blocks_blocks_4_47NumDims = 4;
            x_blocks_blocks_4_47 = severity_net_epoch_10.coder.ops.permuteInputVar(x_blocks_blocks_4_47_, [4 3 1 2], 4);

            [x_blocks_blocks_4_53__, x_blocks_blocks_4_53NumDims__] = ReduceMeanGraph1048(this, x_blocks_blocks_4_47, x_blocks_blocks_4_47NumDims, false);
            x_blocks_blocks_4_53_ = severity_net_epoch_10.coder.ops.permuteOutputVar(x_blocks_blocks_4_53__, [3 4 2 1], 4);

            x_blocks_blocks_4_53 = dlarray(single(x_blocks_blocks_4_53_), 'SSCB');
        end

        function [x_blocks_blocks_4_53, x_blocks_blocks_4_53NumDims1050] = ReduceMeanGraph1048(this, x_blocks_blocks_4_47, x_blocks_blocks_4_47NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1032 = severity_net_epoch_10.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1049, coder.const(x_blocks_blocks_4_47NumDims));
            xReduced1033 = mean(x_blocks_blocks_4_47, dims1032);
            x_blocks_blocks_4_53 = xReduced1033;
            x_blocks_blocks_4_53NumDims = coder.const(x_blocks_blocks_4_47NumDims);

            % Set graph output arguments
            x_blocks_blocks_4_53NumDims1050 = coder.const(x_blocks_blocks_4_53NumDims);

        end

    end

end